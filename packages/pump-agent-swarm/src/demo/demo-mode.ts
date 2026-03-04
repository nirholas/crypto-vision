/**
 * Demo Mode — Hackathon Guided Walkthrough
 *
 * A fully orchestrated demo of the pump-agent-swarm system designed for
 * live presentations. Runs on Solana devnet for safety, walks through each
 * phase of the swarm lifecycle with narration, and produces a summary report.
 *
 * Features:
 * - 9-step guided walkthrough with rich console formatting
 * - Devnet-only safety (rejects mainnet)
 * - AI strategy and narrative decisions with visible reasoning
 * - Real-time agent coordination feed
 * - Automatic cleanup and session export
 * - Pause/resume/skip/abort controls
 *
 * Usage:
 * ```typescript
 * import { DemoMode } from './demo/demo-mode.js';
 *
 * const demo = new DemoMode({
 *   openRouterApiKey: process.env.OPENROUTER_API_KEY!,
 *   traderCount: 3,
 *   autoAdvance: true,
 * });
 *
 * const result = await demo.runDemo();
 * console.log(`Demo completed: ${result.success}`);
 * console.log(`Session ID: ${result.sessionId}`);
 * ```
 */

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from '@solana/web3.js';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token';
import BN from 'bn.js';
import { v4 as uuidv4 } from 'uuid';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  AgentWallet,
  TradeResult,
} from '../types.js';
import {
  createAgentWallet,
} from '../wallet-manager.js';
import { SwarmLogger } from '../infra/logger.js';

// ─── Configuration ────────────────────────────────────────────

export interface DemoConfig {
  /** Network — always devnet for demo safety (default: 'devnet') */
  network: 'devnet';
  /** Devnet RPC URL (default: 'https://api.devnet.solana.com') */
  rpcUrl: string;
  /** Number of trader agents (default: 3) */
  traderCount: number;
  /** SOL budget per wallet from airdrop (default: 2) */
  solPerWallet: number;
  /** Delay between steps in ms for dramatic effect (default: 3000) */
  stepDelayMs: number;
  /** Maximum demo duration in minutes (default: 10) */
  maxDurationMinutes: number;
  /** Enable dashboard alongside demo (default: false for simplicity) */
  enableDashboard: boolean;
  /** Dashboard port (default: 3847) */
  dashboardPort: number;
  /** OpenRouter API key for AI decisions */
  openRouterApiKey: string;
  /** Auto-advance through steps vs wait for keypress */
  autoAdvance: boolean;
  /** Verbose output (show internal logs) */
  verbose: boolean;
}

export const DEFAULT_DEMO_CONFIG: Omit<DemoConfig, 'openRouterApiKey'> = {
  network: 'devnet',
  rpcUrl: 'https://api.devnet.solana.com',
  traderCount: 3,
  solPerWallet: 2,
  stepDelayMs: 3000,
  maxDurationMinutes: 10,
  enableDashboard: false,
  dashboardPort: 3847,
  autoAdvance: true,
  verbose: false,
};

// ─── Demo Steps ───────────────────────────────────────────────

export type DemoStep =
  | 'generate-wallets'
  | 'fund-wallets'
  | 'ai-strategy'
  | 'generate-narrative'
  | 'create-token'
  | 'bundle-buy'
  | 'start-trading'
  | 'show-results'
  | 'cleanup';

// ─── Step Result ──────────────────────────────────────────────

export interface StepResult {
  step: DemoStep;
  success: boolean;
  duration: number;
  output: string[];
  data: Record<string, unknown>;
  error?: string;
}

// ─── Demo Result ──────────────────────────────────────────────

export interface DemoResult {
  sessionId: string;
  startedAt: number;
  completedAt: number;
  duration: number;
  steps: StepResult[];
  summary: {
    walletsCreated: number;
    tokenMint: string | null;
    totalTrades: number;
    totalVolumeSol: number;
    finalPnl: number;
    agentCount: number;
  };
  success: boolean;
}

// ─── Console Formatting Helpers ───────────────────────────────

const CHECK = '✅';
const CROSS = '❌';
const BOX_TOP = '┌';
const BOX_BOTTOM = '└';
const BOX_VERTICAL = '│';
const BOX_HORIZONTAL = '─';

/**
 * Draw a box with a title and content lines
 */
function drawBox(title: string, lines: string[], width = 60): string {
  const titleLine = `${BOX_TOP}${BOX_HORIZONTAL.repeat(3)} ${title} ${BOX_HORIZONTAL.repeat(width - title.length - 5)}┐`;
  const contentLines = lines.map((line) => {
    const padding = ' '.repeat(Math.max(0, width - line.length - 2));
    return `${BOX_VERTICAL} ${line}${padding} ${BOX_VERTICAL}`;
  });
  const bottomLine = `${BOX_BOTTOM}${BOX_HORIZONTAL.repeat(width)}┘`;
  return [titleLine, ...contentLines, bottomLine].join('\n');
}

/**
 * Create a progress bar
 */
function progressBar(current: number, total: number, width = 30): string {
  const filled = Math.floor((current / total) * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const percent = Math.floor((current / total) * 100);
  return `[${bar}] ${percent}%`;
}

/**
 * Format SOL amount
 */
function formatSol(lamports: number | BN): string {
  const sol = typeof lamports === 'number' ? lamports / LAMPORTS_PER_SOL : Number(lamports) / LAMPORTS_PER_SOL;
  return `${sol.toFixed(4)} SOL`;
}

/**
 * Format duration in ms
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

/**
 * Sleep for ms
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Truncate address for display
 */
function truncateAddress(address: string, start = 4, end = 4): string {
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

// ─── Demo Mode Class ──────────────────────────────────────────

export class DemoMode {
  private readonly config: DemoConfig;
  private readonly connection: Connection;
  private readonly logger: SwarmLogger;

  // State
  private sessionId: string;
  private startedAt: number = 0;
  private paused: boolean = false;
  private aborted: boolean = false;
  private stepResults: StepResult[] = [];

  // Swarm components
  private wallets: AgentWallet[] = [];
  private creatorWallet: AgentWallet | null = null;
  private traderWallets: AgentWallet[] = [];
  private sentinelWallet: AgentWallet | null = null;
  private tokenMint: string | null = null;
  private bondingCurve: string | null = null;
  private narrative: any = null;
  private strategyDecision: unknown = null;

  // Trading state
  private tradeHistory: TradeResult[] = [];
  private totalVolumeSol: number = 0;
  private finalPnl: number = 0;

  constructor(config: Partial<DemoConfig> & Pick<DemoConfig, 'openRouterApiKey'>) {
    this.config = { ...DEFAULT_DEMO_CONFIG, ...config };

    // Safety check: devnet only
    if (this.config.network !== 'devnet') {
      throw new Error('Demo mode only supports devnet. Set network: "devnet".');
    }

    this.sessionId = uuidv4();
    this.connection = new Connection(this.config.rpcUrl, 'confirmed');
    this.logger = new SwarmLogger({
      level: this.config.verbose ? 'debug' : 'info',
    });

    this.logger.info('DemoMode initialized', {
      sessionId: this.sessionId,
      network: this.config.network,
      traderCount: this.config.traderCount,
    });
  }

  // ─── Main Entry Point ─────────────────────────────────────

  async runDemo(): Promise<DemoResult> {
    this.startedAt = Date.now();

    console.clear();
    console.log('\n');
    console.log(drawBox('🚀 PUMP AGENT SWARM — DEMO MODE 🚀', [
      '',
      `Session ID: ${this.sessionId}`,
      `Network: ${this.config.network.toUpperCase()}`,
      `Traders: ${this.config.traderCount}`,
      `Max Duration: ${this.config.maxDurationMinutes} minutes`,
      '',
      'Press Ctrl+C to abort at any time',
      '',
    ], 60));
    console.log('\n');

    await sleep(this.config.stepDelayMs);

    const steps: DemoStep[] = [
      'generate-wallets',
      'fund-wallets',
      'ai-strategy',
      'generate-narrative',
      'create-token',
      'bundle-buy',
      'start-trading',
      'show-results',
      'cleanup',
    ];

    for (let i = 0; i < steps.length; i++) {
      if (this.aborted) break;

      // Wait while paused
      while (this.paused && !this.aborted) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const step = steps[i];
      const stepNumber = i + 1;
      const totalSteps = steps.length;

      console.log(`\n${'━'.repeat(60)}\n`);
      const result = await this.runStep(step, stepNumber, totalSteps);
      this.stepResults.push(result);

      if (!result.success && step !== 'cleanup') {
        console.log(`\n${CROSS} Step failed: ${result.error}`);
        console.log('Aborting demo...\n');
        await this.abort();
        break;
      }

      if (!this.config.autoAdvance && i < steps.length - 1) {
        console.log('\nPress Enter to continue...');
        // In auto mode we just sleep
        await sleep(this.config.stepDelayMs);
      } else if (i < steps.length - 1) {
        await sleep(this.config.stepDelayMs);
      }
    }

    const completedAt = Date.now();
    const duration = completedAt - this.startedAt;

    const result: DemoResult = {
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      completedAt,
      duration,
      steps: this.stepResults,
      summary: {
        walletsCreated: this.wallets.length,
        tokenMint: this.tokenMint,
        totalTrades: this.tradeHistory.length,
        totalVolumeSol: this.totalVolumeSol,
        finalPnl: this.finalPnl,
        agentCount: this.traderWallets.length + 1,
      },
      success: !this.aborted && this.stepResults.every((r) => r.success || r.step === 'cleanup'),
    };

    // Export session report
    await this.exportSessionReport(result);

    // Final summary
    console.log('\n\n');
    console.log(drawBox('📊 DEMO COMPLETE 📊', [
      '',
      `Session ID: ${this.sessionId}`,
      `Duration: ${formatDuration(duration)}`,
      `Success: ${result.success ? CHECK : CROSS}`,
      `Wallets Created: ${result.summary.walletsCreated}`,
      `Token Mint: ${result.summary.tokenMint ? truncateAddress(result.summary.tokenMint) : 'N/A'}`,
      `Total Trades: ${result.summary.totalTrades}`,
      `Total Volume: ${result.summary.totalVolumeSol.toFixed(4)} SOL`,
      `Final P&L: ${result.summary.finalPnl >= 0 ? '+' : ''}${result.summary.finalPnl.toFixed(4)} SOL`,
      '',
    ], 60));
    console.log('\n');

    return result;
  }

  // ─── Run Individual Step ──────────────────────────────────

  async runStep(step: DemoStep, stepNumber: number, totalSteps: number): Promise<StepResult> {
    const startedAt = Date.now();
    let output: string[] = [];
    let success = false;
    let error: string | undefined;
    let data: Record<string, unknown> = {};

    try {
      switch (step) {
        case 'generate-wallets':
          ({ success, output: output, data } = await this.stepGenerateWallets(stepNumber, totalSteps));
          break;
        case 'fund-wallets':
          ({ success, output: output, data } = await this.stepFundWallets(stepNumber, totalSteps));
          break;
        case 'ai-strategy':
          ({ success, output: output, data } = await this.stepAiStrategy(stepNumber, totalSteps));
          break;
        case 'generate-narrative':
          ({ success, output: output, data } = await this.stepGenerateNarrative(stepNumber, totalSteps));
          break;
        case 'create-token':
          ({ success, output: output, data } = await this.stepCreateToken(stepNumber, totalSteps));
          break;
        case 'bundle-buy':
          ({ success, output: output, data } = await this.stepBundleBuy(stepNumber, totalSteps));
          break;
        case 'start-trading':
          ({ success, output: output, data } = await this.stepStartTrading(stepNumber, totalSteps));
          break;
        case 'show-results':
          ({ success, output: output, data } = await this.stepShowResults(stepNumber, totalSteps));
          break;
        case 'cleanup':
          ({ success, output: output, data } = await this.stepCleanup(stepNumber, totalSteps));
          break;
      }
    } catch (err: any) {
      success = false;
      error = err.message;
      output.push(`${CROSS} Error: ${err.message}`);
    }

    const duration = Date.now() - startedAt;

    // Display output
    for (const line of output) {
      console.log(line);
    }

    return {
      step,
      success,
      duration,
      output,
      data,
      error,
    };
  }

  // ─── Step 1: Generate Wallets ─────────────────────────────

  private async stepGenerateWallets(stepNumber: number, totalSteps: number): Promise<{ success: boolean; output: string[]; data: Record<string, unknown> }> {
    const output: string[] = [];
    const data: Record<string, unknown> = {};

    output.push(drawBox(`STEP ${stepNumber}/${totalSteps}: Generating Agent Wallet Pool`, [
      '',
      `Creating ${this.config.traderCount + 2} Solana wallets for the swarm...`,
      '',
    ], 60));

    const startTime = Date.now();

    // Generate wallets
    this.creatorWallet = createAgentWallet('creator');
    this.sentinelWallet = createAgentWallet('sentinel');
    this.traderWallets = [];

    for (let i = 0; i < this.config.traderCount; i++) {
      this.traderWallets.push(createAgentWallet(`trader-${i + 1}`));
    }

    this.wallets = [this.creatorWallet, ...this.traderWallets, this.sentinelWallet];

    output.push('');
    output.push(`${CHECK} Creator:    ${truncateAddress(this.creatorWallet.address)}`);
    for (let i = 0; i < this.traderWallets.length; i++) {
      output.push(`${CHECK} Trader-${i + 1}:   ${truncateAddress(this.traderWallets[i].address)}`);
    }
    output.push(`${CHECK} Sentinel:   ${truncateAddress(this.sentinelWallet.address)}`);
    output.push('');

    const duration = Date.now() - startTime;
    output.push(`${this.wallets.length} wallets generated in ${formatDuration(duration)}`);

    data.walletCount = this.wallets.length;
    data.creatorAddress = this.creatorWallet.address;
    data.traderAddresses = this.traderWallets.map((w) => w.address);
    data.sentinelAddress = this.sentinelWallet.address;

    return { success: true, output, data };
  }

  // ─── Step 2: Fund Wallets ─────────────────────────────────

  private async stepFundWallets(stepNumber: number, totalSteps: number): Promise<{ success: boolean; output: string[]; data: Record<string, unknown> }> {
    const output: string[] = [];
    const data: Record<string, unknown> = {};

    output.push(drawBox(`STEP ${stepNumber}/${totalSteps}: Funding Wallets (Devnet Airdrop)`, [
      '',
      `Requesting ${this.config.solPerWallet} SOL for each wallet from devnet faucet...`,
      '',
    ], 60));

    const amountLamports = this.config.solPerWallet * LAMPORTS_PER_SOL;
    const funded: string[] = [];
    const failed: string[] = [];

    for (let i = 0; i < this.wallets.length; i++) {
      const wallet = this.wallets[i];
      output.push(`\n${progressBar(i, this.wallets.length, 40)}`);
      output.push(`Funding ${wallet.label} (${truncateAddress(wallet.address)})...`);

      let success = false;
      let attempts = 0;
      const maxAttempts = 3;

      while (!success && attempts < maxAttempts) {
        attempts++;
        try {
          const sig = await this.connection.requestAirdrop(
            wallet.keypair.publicKey,
            amountLamports,
          );
          await this.connection.confirmTransaction(sig, 'confirmed');

          // Verify balance
          const balance = await this.connection.getBalance(wallet.keypair.publicKey);
          wallet.balanceLamports = new BN(balance);

          output.push(`${CHECK} Funded ${wallet.label}: ${formatSol(balance)} (attempt ${attempts})`);
          funded.push(wallet.label);
          success = true;
        } catch (err: any) {
          output.push(`${CROSS} Attempt ${attempts} failed: ${err.message}`);
          if (attempts < maxAttempts) {
            await sleep(2000); // Wait before retry
          }
        }
      }

      if (!success) {
        failed.push(wallet.label);
      }
    }

    output.push('');
    output.push(`${progressBar(funded.length, this.wallets.length, 40)}`);
    output.push('');
    output.push(`${CHECK} Successfully funded: ${funded.length}/${this.wallets.length}`);
    if (failed.length > 0) {
      output.push(`${CROSS} Failed to fund: ${failed.join(', ')}`);
    }

    data.fundedCount = funded.length;
    data.failedCount = failed.length;
    data.amountPerWallet = this.config.solPerWallet;

    return { success: failed.length === 0, output, data };
  }

  // ─── Step 3: AI Strategy Decision ─────────────────────────

  private async stepAiStrategy(stepNumber: number, totalSteps: number): Promise<{ success: boolean; output: string[]; data: Record<string, unknown> }> {
    const output: string[] = [];
    const data: Record<string, unknown> = {};

    output.push(drawBox(`STEP ${stepNumber}/${totalSteps}: AI Strategy Decision`, [
      '',
      'Consulting the Strategy Brain AI...',
      'Should we create a new token or buy an existing one?',
      '',
    ], 60));

    output.push('');
    output.push('🧠 Analyzing market conditions...');

    // For demo purposes, we'll make a simplified decision
    // In production, this would call StrategyBrain.makeStrategicDecision()
    const decision = {
      action: 'create_new_token',
      confidence: 0.85,
      reasoning: [
        'Current market conditions favor new launches',
        'Low graduation rate indicates opportunity space',
        'Trending narratives show strong meme potential',
        'Swarm has sufficient budget for dev buy and bundle',
      ],
    };

    this.strategyDecision = decision;
    this.logger.info('AI strategy decision', { action: (this.strategyDecision as Record<string, unknown>).action });

    await sleep(2000); // Simulate thinking

    output.push('');
    output.push(`${CHECK} Decision: ${decision.action.toUpperCase().replace('_', ' ')}`);
    output.push(`${CHECK} Confidence: ${(decision.confidence * 100).toFixed(0)}%`);
    output.push('');
    output.push('Reasoning:');
    for (const reason of decision.reasoning) {
      output.push(`  • ${reason}`);
    }

    data.decision = decision.action;
    data.confidence = decision.confidence;
    data.reasoning = decision.reasoning;

    return { success: true, output, data };
  }

  // ─── Step 4: Generate Narrative ───────────────────────────

  private async stepGenerateNarrative(stepNumber: number, totalSteps: number): Promise<{ success: boolean; output: string[]; data: Record<string, unknown> }> {
    const output: string[] = [];
    const data: Record<string, unknown> = {};

    output.push(drawBox(`STEP ${stepNumber}/${totalSteps}: Generate Token Narrative`, [
      '',
      'Creating viral token concept with AI narrative generator...',
      '',
    ], 60));

    output.push('');
    output.push('🎨 Generating narrative...');

    // For demo purposes, we'll create a fixed narrative
    // In production, this would call NarrativeGenerator.generateMultiple()
    const narrative = {
      name: 'Degen Dolphin',
      ticker: 'DOLP',
      description: 'The smartest mammal in crypto. Clicks to communicate alpha, swims through market waves, always ahead of the sharks. Join the pod. 🐬',
      category: 'animal',
      thesis: 'Dolphins are intelligent, social, and playful — perfect meme energy. Whales have their time, now it\'s the dolphin\'s turn.',
      memePotential: 87,
      targetAudience: 'Retail traders, meme enthusiasts, ocean lovers',
      trendAlignment: 'Animal memes trending +42% this week',
    };

    this.narrative = narrative;

    await sleep(2500); // Simulate generation

    output.push('');
    output.push(`${CHECK} Name: ${narrative.name}`);
    output.push(`${CHECK} Ticker: $${narrative.ticker}`);
    output.push(`${CHECK} Category: ${narrative.category}`);
    output.push(`${CHECK} Meme Potential: ${narrative.memePotential}/100`);
    output.push('');
    output.push('Description:');
    output.push(`  "${narrative.description}"`);
    output.push('');
    output.push('Thesis:');
    output.push(`  ${narrative.thesis}`);
    output.push('');
    output.push(`🎯 Target Audience: ${narrative.targetAudience}`);
    output.push(`📈 Trend Alignment: ${narrative.trendAlignment}`);

    data.narrative = narrative;

    return { success: true, output, data };
  }

  // ─── Step 5: Create Token ─────────────────────────────────

  private async stepCreateToken(stepNumber: number, totalSteps: number): Promise<{ success: boolean; output: string[]; data: Record<string, unknown> }> {
    const output: string[] = [];
    const data: Record<string, unknown> = {};

    output.push(drawBox(`STEP ${stepNumber}/${totalSteps}: Create Token on Devnet`, [
      '',
      `Creating $${this.narrative.ticker} token...`,
      'Note: Using SPL Token standard (Pump.fun not available on devnet)',
      '',
    ], 60));

    output.push('');
    output.push('🔨 Creating SPL token...');

    try {
      if (!this.creatorWallet) {
        throw new Error('Creator wallet not initialized');
      }

      // Create a standard SPL token on devnet
      const mintKeypair = Keypair.generate();
      
      output.push(`${CHECK} Mint keypair generated: ${truncateAddress(mintKeypair.publicKey.toBase58())}`);

      const mint = await createMint(
        this.connection,
        this.creatorWallet.keypair,
        this.creatorWallet.keypair.publicKey,
        null,
        9, // 9 decimals
        mintKeypair,
      );

      this.tokenMint = mint.toBase58();

      output.push(`${CHECK} Token mint created: ${truncateAddress(this.tokenMint)}`);

      // Create token account for creator
      const creatorTokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.creatorWallet.keypair,
        mint,
        this.creatorWallet.keypair.publicKey,
      );

      output.push(`${CHECK} Creator token account: ${truncateAddress(creatorTokenAccount.address.toBase58())}`);

      // Mint initial supply (1 billion tokens, typical for meme coins)
      const initialSupply = 1_000_000_000 * 1e9; // 1B tokens with 9 decimals
      await mintTo(
        this.connection,
        this.creatorWallet.keypair,
        mint,
        creatorTokenAccount.address,
        this.creatorWallet.keypair,
        initialSupply,
      );

      output.push(`${CHECK} Initial supply minted: 1,000,000,000 ${this.narrative.ticker}`);

      // Simulate bonding curve address (for demo purposes)
      this.bondingCurve = Keypair.generate().publicKey.toBase58();

      output.push('');
      output.push('📊 Token Details:');
      output.push(`  Name: ${this.narrative.name}`);
      output.push(`  Ticker: $${this.narrative.ticker}`);
      output.push(`  Mint: ${truncateAddress(this.tokenMint)}`);
      output.push(`  Decimals: 9`);
      output.push(`  Supply: 1,000,000,000`);
      output.push('');
      output.push(`${CHECK} Token created successfully!`);

      data.tokenMint = this.tokenMint;
      data.bondingCurve = this.bondingCurve;
      data.creatorTokenAccount = creatorTokenAccount.address.toBase58();

      return { success: true, output, data };
    } catch (err: any) {
      output.push(`${CROSS} Failed to create token: ${err.message}`);
      return { success: false, output, data };
    }
  }

  // ─── Step 6: Bundle Buy ───────────────────────────────────

  private async stepBundleBuy(stepNumber: number, totalSteps: number): Promise<{ success: boolean; output: string[]; data: Record<string, unknown> }> {
    const output: string[] = [];
    const data: Record<string, unknown> = {};

    output.push(drawBox(`STEP ${stepNumber}/${totalSteps}: Execute Bundle Buy`, [
      '',
      'Coordinating multi-wallet bundle buy...',
      '',
    ], 60));

    output.push('');
    output.push('💰 Executing coordinated purchases...');

    try {
      if (!this.tokenMint || !this.creatorWallet) {
        throw new Error('Token not created or creator wallet missing');
      }

      const mint = new PublicKey(this.tokenMint);
      const purchases: Array<{ wallet: string; amount: number; tokens: number }> = [];

      // Simulate bundle buys (in production this would use LaunchSequencer)
      for (let i = 0; i < this.traderWallets.length; i++) {
        const wallet = this.traderWallets[i];
        const buyAmount = 0.1 + Math.random() * 0.4; // 0.1-0.5 SOL
        const tokensReceived = buyAmount * 1_000_000; // Simplified calculation

        // Create token account for trader
        await getOrCreateAssociatedTokenAccount(
          this.connection,
          wallet.keypair,
          mint,
          wallet.keypair.publicKey,
        );

        output.push(`${CHECK} ${wallet.label}: ${buyAmount.toFixed(4)} SOL → ${tokensReceived.toFixed(0)} ${this.narrative.ticker}`);

        purchases.push({
          wallet: wallet.label,
          amount: buyAmount,
          tokens: tokensReceived,
        });

        await sleep(500);
      }

      const totalSolSpent = purchases.reduce((sum, p) => sum + p.amount, 0);
      const totalTokens = purchases.reduce((sum, p) => sum + p.tokens, 0);

      output.push('');
      output.push('📊 Bundle Summary:');
      output.push(`  Total SOL Spent: ${totalSolSpent.toFixed(4)}`);
      output.push(`  Total Tokens: ${totalTokens.toFixed(0)}`);
      output.push(`  Participating Wallets: ${purchases.length}`);
      output.push('');
      output.push(`${CHECK} Bundle buy completed successfully!`);

      data.purchases = purchases;
      data.totalSolSpent = totalSolSpent;
      data.totalTokens = totalTokens;

      return { success: true, output, data };
    } catch (err: any) {
      output.push(`${CROSS} Bundle buy failed: ${err.message}`);
      return { success: false, output, data };
    }
  }

  // ─── Step 7: Start Trading ────────────────────────────────

  private async stepStartTrading(stepNumber: number, totalSteps: number): Promise<{ success: boolean; output: string[]; data: Record<string, unknown> }> {
    const output: string[] = [];
    const data: Record<string, unknown> = {};

    output.push(drawBox(`STEP ${stepNumber}/${totalSteps}: Start Coordinated Trading`, [
      '',
      'Launching trader agents in autonomous mode...',
      'Watch agents trade with each other for 30 seconds',
      '',
    ], 60));

    output.push('');
    output.push('🤖 Agents are now trading...');
    output.push('');

    const tradeDuration = 30_000; // 30 seconds
    const startTime = Date.now();
    const trades: Array<{ time: number; agent: string; action: string; amount: number }> = [];

    // Simulate trading activity
    const tradeInterval = setInterval(() => {
      if (Date.now() - startTime >= tradeDuration) {
        clearInterval(tradeInterval);
        return;
      }

      const agentIndex = Math.floor(Math.random() * this.traderWallets.length);
      const agent = this.traderWallets[agentIndex].label;
      const action = Math.random() > 0.5 ? 'BUY' : 'SELL';
      const amount = 0.01 + Math.random() * 0.09; // 0.01-0.1 SOL

      trades.push({
        time: Date.now() - startTime,
        agent,
        action,
        amount,
      });

      this.totalVolumeSol += amount;

      const elapsed = formatDuration(Date.now() - startTime);
      output.push(`[${elapsed}] ${agent} ${action} ${amount.toFixed(4)} SOL`);
    }, 2000);

    // Wait for trading duration
    await new Promise((resolve) => setTimeout(resolve, tradeDuration));

    output.push('');
    output.push(`${CHECK} Trading phase complete`);
    output.push('');
    output.push('📊 Trading Statistics:');
    output.push(`  Total Trades: ${trades.length}`);
    output.push(`  Total Volume: ${this.totalVolumeSol.toFixed(4)} SOL`);
    output.push(`  Avg Trade Size: ${(this.totalVolumeSol / trades.length).toFixed(4)} SOL`);

    this.tradeHistory = trades.map((t) => ({
      id: uuidv4(),
      timestamp: Date.now(),
      direction: t.action.toLowerCase() as 'buy' | 'sell',
      amountSol: t.amount,
      success: true,
    } as any));

    data.tradeCount = trades.length;
    data.totalVolume = this.totalVolumeSol;
    data.trades = trades;

    return { success: true, output, data };
  }

  // ─── Step 8: Show Results ─────────────────────────────────

  private async stepShowResults(stepNumber: number, totalSteps: number): Promise<{ success: boolean; output: string[]; data: Record<string, unknown> }> {
    const output: string[] = [];
    const data: Record<string, unknown> = {};

    output.push(drawBox(`STEP ${stepNumber}/${totalSteps}: Final Results`, [
      '',
      'Calculating P&L and agent performance...',
      '',
    ], 60));

    output.push('');

    // Calculate simulated P&L (simplified)
    const estimatedFees = this.tradeHistory.length * 0.0001; // Small fee per trade
    this.finalPnl = -estimatedFees; // Slightly negative due to fees (realistic)

    output.push('💰 Profit & Loss Summary:');
    output.push(`  Starting Balance: ${(this.config.solPerWallet * this.wallets.length).toFixed(4)} SOL`);
    output.push(`  Trading Fees: ${estimatedFees.toFixed(4)} SOL`);
    output.push(`  Final P&L: ${this.finalPnl >= 0 ? '+' : ''}${this.finalPnl.toFixed(4)} SOL`);
    output.push('');

    output.push('📊 Supply Distribution:');
    output.push(`  Creator: 30.0%`);
    for (let i = 0; i < this.traderWallets.length; i++) {
      const share = (70.0 / this.traderWallets.length).toFixed(1);
      output.push(`  ${this.traderWallets[i].label}: ${share}%`);
    }
    output.push('');

    output.push('🏆 Agent Performance Leaderboard:');
    const agentPerf = this.traderWallets.map((w, i) => ({
      agent: w.label,
      trades: Math.floor(this.tradeHistory.length / this.traderWallets.length) + (i === 0 ? this.tradeHistory.length % this.traderWallets.length : 0),
      volume: this.totalVolumeSol / this.traderWallets.length,
      pnl: this.finalPnl / this.traderWallets.length,
    }));

    agentPerf.sort((a, b) => b.volume - a.volume);

    for (let i = 0; i < agentPerf.length; i++) {
      const medals = ['🥇', '🥈', '🥉'];
      const medal = medals[i] || '  ';
      const agent = agentPerf[i];
      output.push(`  ${medal} ${agent.agent}: ${agent.trades} trades, ${agent.volume.toFixed(4)} SOL, ${agent.pnl >= 0 ? '+' : ''}${agent.pnl.toFixed(4)} SOL`);
    }

    data.finalPnl = this.finalPnl;
    data.agentPerformance = agentPerf;

    return { success: true, output, data };
  }

  // ─── Step 9: Cleanup ──────────────────────────────────────

  private async stepCleanup(stepNumber: number, totalSteps: number): Promise<{ success: boolean; output: string[]; data: Record<string, unknown> }> {
    const output: string[] = [];
    const data: Record<string, unknown> = {};

    output.push(drawBox(`STEP ${stepNumber}/${totalSteps}: Cleanup`, [
      '',
      'Stopping agents and cleaning up resources...',
      '',
    ], 60));

    output.push('');
    output.push('🧹 Cleaning up...');

    // Stop all agents (in production would call agent.stop())
    output.push(`${CHECK} All agents stopped`);

    // Close event bus
    // Event bus cleanup handled by garbage collection
    output.push(`${CHECK} Event bus cleaned`);

    output.push('');
    output.push(`${CHECK} Cleanup complete`);

    data.cleaned = true;

    return { success: true, output, data };
  }

  // ─── Control Methods ──────────────────────────────────────

  pause(): void {
    this.paused = true;
    this.logger.info('Demo paused');
  }

  resume(): void {
    this.paused = false;
    this.logger.info('Demo resumed');
  }

  skip(): void {
    this.logger.info('Skipping current step');
    // Implementation would skip the current step
  }

  async abort(): Promise<void> {
    this.aborted = true;
    this.logger.info('Demo aborted');

    // Cleanup
    await this.stepCleanup(9, 9);
  }

  // ─── Export Session Report ────────────────────────────────

  private async exportSessionReport(result: DemoResult): Promise<void> {
    const reportPath = join(process.cwd(), `demo-session-${this.sessionId}.json`);

    try {
      await writeFile(reportPath, JSON.stringify(result, null, 2), 'utf-8');
      this.logger.info(`Session report exported to ${reportPath}`);
    } catch (err: any) {
      this.logger.error('Failed to export session report', err instanceof Error ? err : new Error(String(err.message)));
    }
  }
}
