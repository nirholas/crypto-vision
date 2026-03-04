/**
 * Swarm Coordinator — Orchestrates the full Pump.fun agent lifecycle
 *
 * This is the main entry point. It:
 *
 * 1. INITIALIZING  — Generates wallet pool, funds traders from creator
 * 2. MINTING       — Creator agent mints token + dev buy (+ optional bundles)
 * 3. TRADING       — Trader agents buy/sell the token on the bonding curve
 * 4. GRADUATING    — Monitors curve progress, stops when graduated (or budget exhausted)
 * 5. COMPLETED     — Reclaims remaining SOL, reports final P&L
 *
 * x402 Integration:
 * - Optionally calls premium analytics APIs (bonding curve state, holder analysis,
 *   rug scoring) via the AnalyticsClient, paying per-request with USDC
 * - Agents pay for intelligence → make smarter trades → the x402 payment is invisible
 *
 * Visual flow (what you'd show in a UI builder):
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │  USER CONFIG                                                     │
 *   │  token name, symbol, metadata URI                               │
 *   │  dev buy amount, trader count, strategy params                  │
 *   └─────────────┬────────────────────────────────────────────────────┘
 *                 │
 *   ┌─────────────▼────────────────┐
 *   │  WALLET POOL                 │
 *   │  Creator: 5rXy...           │
 *   │  Trader 0: 3hKp...         │
 *   │  Trader 1: 7mNq...         │
 *   │  Trader 2: 9wTj...         │
 *   └─────────────┬────────────────┘
 *                 │
 *   ┌─────────────▼────────────────┐
 *   │  CREATOR AGENT               │
 *   │  createV2Instruction()       │
 *   │  + atomic dev buy (0.5 SOL)  │
 *   │  → mint: 4xPq...           │
 *   └─────────────┬────────────────┘
 *                 │
 *   ┌─────────────▼────────────────────────────────────────────────────┐
 *   │  TRADER AGENTS (concurrent)                                      │
 *   │                                                                  │
 *   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
 *   │  │ Trader 0     │  │ Trader 1     │  │ Trader 2     │          │
 *   │  │ BUY 0.1 SOL  │  │ SELL 50%     │  │ BUY 0.05 SOL │          │
 *   │  │ ↕ 15-45s     │  │ ↕ 20-60s     │  │ ↕ 10-30s     │          │
 *   │  └──────────────┘  └──────────────┘  └──────────────┘          │
 *   │                                                                  │
 *   │  ┌─────────────────────────────────────────────┐                │
 *   │  │ x402 ANALYTICS (optional, paid per-request) │                │
 *   │  │ GET /api/premium/pump/analytics → 402       │                │
 *   │  │ → auto-pay 0.02 USDC → retry → data        │                │
 *   │  └─────────────────────────────────────────────┘                │
 *   └─────────────┬────────────────────────────────────────────────────┘
 *                 │
 *   ┌─────────────▼────────────────┐
 *   │  GRADUATION / STOP           │
 *   │  curve.complete === true      │
 *   │  OR budget exhausted          │
 *   │  OR max duration reached      │
 *   └─────────────┬────────────────┘
 *                 │
 *   ┌─────────────▼────────────────┐
 *   │  CLEANUP                      │
 *   │  Reclaim SOL from traders    │
 *   │  Final P&L report            │
 *   └──────────────────────────────┘
 */

import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import BN from 'bn.js';
import { EventEmitter } from 'eventemitter3';
import { CreatorAgent } from './agents/creator-agent.js';
import { TraderAgent } from './agents/trader-agent.js';
import { SolanaX402Client } from './x402/client.js';
import {
  generateWalletPool,
  refreshBalances,
  fundTraders,
  reclaimFunds,
  getPoolSummary,
} from './wallet-manager.js';
import type {
  SwarmConfig,
  SwarmStatus,
  SwarmEvents,
  WalletPool,
  MintResult,
  TradeResult,
  TokenAnalytics,
  TraderStats,
} from './types.js';

// ─── Swarm Coordinator ───────────────────────────────────────

export class SwarmCoordinator extends EventEmitter<SwarmEvents> {
  private readonly config: SwarmConfig;
  private readonly connection: Connection;

  private pool: WalletPool | null = null;
  private creatorAgent: CreatorAgent | null = null;
  private traderAgents: TraderAgent[] = [];
  private analyticsClient: SolanaX402Client | null = null;

  private mintResult: MintResult | null = null;
  private phase: SwarmStatus['phase'] = 'initializing';
  private startedAt = 0;
  private totalTrades = 0;
  private successfulTrades = 0;
  private failedTrades = 0;
  private analyticsInterval: ReturnType<typeof setInterval> | null = null;
  private latestAnalytics: TokenAnalytics | null = null;

  constructor(config: SwarmConfig) {
    super();
    this.config = config;
    this.connection = new Connection(config.rpcUrl, {
      commitment: 'confirmed',
      wsEndpoint: config.wsUrl,
    });
  }

  /**
   * Run the full swarm lifecycle: init → mint → trade → cleanup.
   */
  async run(): Promise<SwarmStatus> {
    this.startedAt = Date.now();

    try {
      // Phase 1: Initialize wallets
      this.setPhase('initializing');
      await this.initialize();

      // Phase 2: Mint token
      this.setPhase('minting');
      await this.mint();

      // Phase 3: Trade
      this.setPhase('trading');
      await this.trade();

      // Phase 4: Cleanup
      this.setPhase('completed');
      await this.cleanup();
    } catch (error) {
      this.setPhase('error');
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);
      // Attempt cleanup even on error
      try {
        await this.cleanup();
      } catch {
        // Best effort
      }
      throw err;
    }

    const finalStatus = this.getStatus();
    this.emit('swarm:stopped', finalStatus);
    return finalStatus;
  }

  /**
   * Stop the swarm gracefully mid-execution.
   */
  async stop(): Promise<SwarmStatus> {
    console.log('[swarm] Stopping...');
    this.setPhase('stopped');

    // Stop all traders
    for (const trader of this.traderAgents) {
      trader.stop('swarm-stopped');
    }

    // Stop analytics polling
    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval);
      this.analyticsInterval = null;
    }

    // Cleanup
    await this.cleanup();

    const status = this.getStatus();
    this.emit('swarm:stopped', status);
    return status;
  }

  // ─── Phase 1: Initialize ───────────────────────────────────

  private async initialize(): Promise<void> {
    console.log('[swarm] Initializing wallet pool...');

    // Generate wallets
    this.pool = generateWalletPool(this.config.traderCount);
    await refreshBalances(this.connection, this.pool);

    const summary = getPoolSummary(this.pool);
    console.log('[swarm] Creator wallet:', summary.creator.address,
      `(${summary.creator.balanceSol} SOL)`);
    for (const t of summary.traders) {
      console.log(`[swarm]   ${t.label}: ${t.address} (${t.balanceSol} SOL)`);
    }

    // Fund traders from creator
    const totalTraderFunding = this.config.strategy.maxTotalBudgetLamports;
    if (totalTraderFunding.gtn(0) && this.pool.creator.balanceLamports.gt(totalTraderFunding)) {
      console.log(`[swarm] Funding ${this.config.traderCount} traders...`);
      await fundTraders(this.connection, this.pool, totalTraderFunding);
    }

    // Initialize Solana x402 analytics client if configured
    if (this.config.analyticsApiUrl) {
      this.analyticsClient = new SolanaX402Client({
        apiBaseUrl: this.config.analyticsApiUrl,
        rpcUrl: this.config.rpcUrl,
        wsUrl: this.config.wsUrl,
        solanaPrivateKey: this.config.solanaPrivateKey,
        maxPaymentPerRequest: '0.05',
        maxTotalBudget: '5.00',
        devMode: this.config.devMode,
        network: 'mainnet-beta',
      });

      // Wire up analytics events
      this.analyticsClient.on('payment:confirmed', (signature, amount) => {
        this.emit('analytics:x402-payment', amount, signature);
      });
    }
  }

  // ─── Phase 2: Mint ─────────────────────────────────────────

  private async mint(): Promise<void> {
    if (!this.pool) throw new Error('Wallet pool not initialized');

    console.log(`[swarm] Creating token: ${this.config.token.name} ($${this.config.token.symbol})`);

    // Create the creator agent
    this.creatorAgent = new CreatorAgent(this.config.rpcUrl, this.pool.creator);

    // Mint the token with dev buy
    this.mintResult = await this.creatorAgent.createToken(
      this.config.token,
      this.config.bundle,
    );

    console.log(`[swarm] Token created!`);
    console.log(`[swarm]   Mint: ${this.mintResult.mint}`);
    console.log(`[swarm]   Bonding curve: ${this.mintResult.bondingCurve}`);
    console.log(`[swarm]   Signature: ${this.mintResult.signature}`);

    if (this.mintResult.devBuyTokens) {
      console.log(`[swarm]   Dev buy tokens: ${this.mintResult.devBuyTokens.toString()}`);
    }

    this.emit('token:created', this.mintResult);

    // Execute bundle buys if configured
    if (this.config.bundle.bundleWallets.length > 0) {
      console.log(`[swarm] Executing ${this.config.bundle.bundleWallets.length} bundle buys...`);
      await this.creatorAgent.executeBundleBuys(
        this.mintResult.mint,
        this.config.bundle,
      );
    }
  }

  // ─── Phase 3: Trade ────────────────────────────────────────

  private async trade(): Promise<void> {
    if (!this.pool || !this.mintResult) {
      throw new Error('Cannot trade: pool or mint not initialized');
    }

    console.log(`[swarm] Starting ${this.config.traderCount} trader agents...`);

    // Create trader agents
    for (let i = 0; i < this.pool.traders.length; i++) {
      const trader = new TraderAgent(
        `trader-${i}`,
        this.pool.traders[i],
        this.connection,
        this.config.strategy,
      );

      // Wire up trade events
      trader.on('trade:executed', (result: TradeResult) => {
        this.totalTrades++;
        if (result.success) {
          this.successfulTrades++;
        } else {
          this.failedTrades++;
        }
        this.emit('trade:executed', result);
      });

      trader.on('trade:failed', (order, error) => {
        this.totalTrades++;
        this.failedTrades++;
        this.emit('trade:failed', order, error);
      });

      trader.on('stopped', (reason) => {
        console.log(`[swarm] Trader ${i} stopped: ${reason}`);
        this.checkAllTradersStopped();
      });

      this.traderAgents.push(trader);
    }

    // Start all traders
    for (const trader of this.traderAgents) {
      trader.start(this.mintResult.mint);
    }

    // Start analytics polling (if configured)
    if (this.analyticsClient) {
      this.startAnalyticsPolling();
    }

    // Wait for all traders to finish (or be stopped)
    await this.waitForTradersToFinish();
  }

  /**
   * Poll the x402 analytics API periodically.
   *
   * This is the key x402 integration — each poll costs a micropayment,
   * and the data informs trading decisions.
   */
  private startAnalyticsPolling(): void {
    if (!this.analyticsClient || !this.mintResult) return;

    const pollIntervalMs = 60_000; // Every 60 seconds
    const mint = this.mintResult.mint;

    this.analyticsInterval = setInterval(async () => {
      if (this.phase !== 'trading') {
        if (this.analyticsInterval) {
          clearInterval(this.analyticsInterval);
          this.analyticsInterval = null;
        }
        return;
      }

      try {
        const analytics = await this.analyticsClient!.getTokenAnalytics(mint);
        this.latestAnalytics = analytics;
        this.emit('analytics:fetched', analytics);

        // Check for graduation
        if (analytics.bondingCurve.complete) {
          console.log('[swarm] Token has graduated! Stopping trading.');
          this.setPhase('graduating');
          this.emit('curve:graduated', mint);
          for (const trader of this.traderAgents) {
            trader.stop('graduated');
          }
        }

        // Log analytics summary
        console.log(`[swarm] Analytics: price=${analytics.bondingCurve.currentPriceSol.toFixed(8)} SOL, ` +
          `mcap=${analytics.bondingCurve.marketCapSol.toFixed(2)} SOL, ` +
          `holders=${analytics.holderCount}, ` +
          `grad=${analytics.bondingCurve.graduationProgress.toFixed(1)}%`);
      } catch (error) {
        console.warn('[swarm] Analytics fetch failed:', error);
      }
    }, pollIntervalMs);
  }

  private waitForTradersToFinish(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (this.traderAgents.every((t) => !t.isRunning())) {
          resolve();
        }
      };

      // Check periodically
      const interval = setInterval(() => {
        check();
        if (this.traderAgents.every((t) => !t.isRunning())) {
          clearInterval(interval);
        }
      }, 5000);

      // Also resolve immediately if all traders are already stopped
      check();
    });
  }

  private checkAllTradersStopped(): void {
    if (this.traderAgents.every((t) => !t.isRunning())) {
      console.log('[swarm] All traders stopped.');
    }
  }

  // ─── Phase 5: Cleanup ──────────────────────────────────────

  private async cleanup(): Promise<void> {
    if (!this.pool) return;

    console.log('[swarm] Cleaning up...');

    // Stop analytics polling
    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval);
      this.analyticsInterval = null;
    }

    // Reclaim SOL from trader wallets
    try {
      const sigs = await reclaimFunds(this.connection, this.pool);
      if (sigs.length > 0) {
        console.log(`[swarm] Reclaimed SOL from ${sigs.length} trader wallets`);
      }
    } catch (error) {
      console.warn('[swarm] Failed to reclaim funds:', error);
    }

    // Print final summary
    this.printSummary();
  }

  // ─── Status & Reporting ────────────────────────────────────

  private setPhase(phase: SwarmStatus['phase']): void {
    this.phase = phase;
    console.log(`[swarm] Phase: ${phase}`);
    this.emit('phase:change', phase);
  }

  getStatus(): SwarmStatus {
    const traderStats = new Map<string, TraderStats>();
    let totalSolSpent = new BN(0);
    let totalSolReceived = new BN(0);

    for (const trader of this.traderAgents) {
      const stats = trader.getStats();
      traderStats.set(stats.traderId, stats);
      totalSolSpent = totalSolSpent.add(stats.solSpent);
      totalSolReceived = totalSolReceived.add(stats.solReceived);
    }

    // Add creator's dev buy
    if (this.mintResult?.devBuySol) {
      totalSolSpent = totalSolSpent.add(this.mintResult.devBuySol);
    }

    return {
      phase: this.phase,
      mint: this.mintResult?.mint,
      totalTrades: this.totalTrades,
      successfulTrades: this.successfulTrades,
      failedTrades: this.failedTrades,
      totalSolSpent,
      totalSolReceived,
      netPnlSol: totalSolReceived.sub(totalSolSpent),
      currentMarketCapSol: this.latestAnalytics?.bondingCurve.marketCapSol,
      graduationProgress: this.latestAnalytics?.bondingCurve.graduationProgress,
      activeTraders: this.traderAgents.filter((t) => t.isRunning()).length,
      uptimeSeconds: (Date.now() - this.startedAt) / 1000,
      traderStats,
      x402PaymentsMade: this.analyticsClient?.getRequestCount() ?? 0,
      x402TotalSpentUsdc: this.analyticsClient?.getTotalSpentUsdc() ?? 0,
    };
  }

  private printSummary(): void {
    const status = this.getStatus();

    console.log('\n' + '='.repeat(60));
    console.log('  PUMP AGENT SWARM — FINAL REPORT');
    console.log('='.repeat(60));
    console.log(`  Token: ${this.config.token.name} ($${this.config.token.symbol})`);
    console.log(`  Mint:  ${status.mint ?? 'N/A'}`);
    console.log(`  Phase: ${status.phase}`);
    console.log(`  Duration: ${status.uptimeSeconds.toFixed(0)}s`);
    console.log('');
    console.log('  Trading:');
    console.log(`    Total trades:      ${status.totalTrades}`);
    console.log(`    Successful:        ${status.successfulTrades}`);
    console.log(`    Failed:            ${status.failedTrades}`);
    console.log(`    SOL spent:         ${(status.totalSolSpent.toNumber() / LAMPORTS_PER_SOL).toFixed(4)}`);
    console.log(`    SOL received:      ${(status.totalSolReceived.toNumber() / LAMPORTS_PER_SOL).toFixed(4)}`);
    console.log(`    Net P&L:           ${(status.netPnlSol.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    console.log('');
    if (status.x402PaymentsMade > 0) {
      console.log('  x402 Analytics:');
      console.log(`    API calls:         ${status.x402PaymentsMade}`);
      console.log(`    USDC spent:        $${status.x402TotalSpentUsdc.toFixed(4)}`);
      console.log('');
    }
    if (status.currentMarketCapSol !== undefined) {
      console.log(`  Market cap:          ${status.currentMarketCapSol.toFixed(2)} SOL`);
      console.log(`  Graduation:          ${status.graduationProgress?.toFixed(1)}%`);
    }
    console.log('='.repeat(60) + '\n');
  }
}
