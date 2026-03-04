/**
 * Test Configuration Helpers
 *
 * Factory functions for creating test-safe SwarmMasterConfig,
 * SwarmEventBus, and logger instances. Every test should use
 * these helpers to ensure isolation.
 */

import BN from 'bn.js';
import { LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import { SwarmEventBus } from '../../infra/event-bus.js';
import { SwarmLogger } from '../../infra/logger.js';
import type {
  SwarmMasterConfig,
  AgentWallet,
  AgentRole,
  TokenConfig,
  TradingStrategy,
  RpcPoolConfig,
  WalletVaultConfig,
  BundleBuyConfig,
  IntelligenceConfig,
  EmergencyExitConfig,
} from '../../types.js';
import type { RiskLimits } from '../../intelligence/risk-manager.js';
import type { AntiDetectionConfig } from '../../bundle/anti-detection.js';

// ─── Event Bus ────────────────────────────────────────────────

/**
 * Create a fresh EventBus instance for an individual test.
 * Avoids singleton pollution between tests.
 */
export function createTestEventBus(historySize = 100): SwarmEventBus {
  SwarmEventBus.resetInstance();
  return new SwarmEventBus(historySize);
}

// ─── Logger ───────────────────────────────────────────────────

/**
 * Create a logger that swallows output (avoids noisy test logs).
 * Set `PUMP_SWARM_LOG=debug` to turn on logs during test debugging.
 */
export function createTestLogger(name = 'test'): SwarmLogger {
  return SwarmLogger.create(name, 'system');
}

// ─── Agent Wallets ────────────────────────────────────────────

/**
 * Generate a deterministic AgentWallet for tests.
 * Uses `Keypair.generate()` each call — keys are random but valid.
 */
export function createTestWallet(
  label = 'test-wallet',
  balanceSol = 10,
): AgentWallet {
  const keypair = Keypair.generate();
  return {
    keypair,
    address: keypair.publicKey.toBase58(),
    label,
    balanceLamports: new BN(balanceSol * LAMPORTS_PER_SOL),
  };
}

/**
 * Generate an array of test wallets.
 */
export function createTestWallets(count: number, prefix = 'trader'): AgentWallet[] {
  return Array.from({ length: count }, (_, i) =>
    createTestWallet(`${prefix}-${i}`, 5),
  );
}

// ─── Token Config ─────────────────────────────────────────────

export function createTestTokenConfig(overrides?: Partial<TokenConfig>): TokenConfig {
  return {
    name: 'Test Token',
    symbol: 'TEST',
    metadataUri: 'https://arweave.net/test-metadata',
    ...overrides,
  };
}

// ─── RPC Config ───────────────────────────────────────────────

export function createTestRpcConfig(overrides?: Partial<RpcPoolConfig>): RpcPoolConfig {
  return {
    endpoints: [
      {
        url: 'https://api.devnet.solana.com',
        weight: 1,
        rateLimit: 10,
        supportsJito: false,
        healthy: true,
        avgLatencyMs: 50,
        errorCount: 0,
        lastSuccessAt: Date.now(),
        provider: 'devnet-public',
      },
    ],
    healthCheckIntervalMs: 30_000,
    maxConsecutiveFailures: 3,
    requestTimeoutMs: 30_000,
    maxRetries: 3,
    preferLowLatency: true,
    ...overrides,
  };
}

// ─── Wallet Config ────────────────────────────────────────────

export function createTestWalletConfig(overrides?: Partial<WalletVaultConfig>): WalletVaultConfig {
  return {
    poolSize: 4,
    minBalanceLamports: new BN(0.01 * LAMPORTS_PER_SOL),
    ...overrides,
  };
}

// ─── Strategy ─────────────────────────────────────────────────

export function createTestStrategy(overrides?: Partial<TradingStrategy>): TradingStrategy {
  return {
    id: 'test-organic',
    name: 'Test Organic Strategy',
    minIntervalSeconds: 5,
    maxIntervalSeconds: 15,
    minTradeSizeLamports: new BN(0.01 * LAMPORTS_PER_SOL),
    maxTradeSizeLamports: new BN(0.1 * LAMPORTS_PER_SOL),
    buySellRatio: 1.2,
    maxTotalBudgetLamports: new BN(5 * LAMPORTS_PER_SOL),
    useJitoBundles: false,
    priorityFeeMicroLamports: 1000,
    maxTrades: 50,
    maxDurationSeconds: 300,
    ...overrides,
  };
}

// ─── Bundle Config ────────────────────────────────────────────

export function createTestBundleConfig(overrides?: Partial<BundleBuyConfig>): BundleBuyConfig {
  return {
    devBuyLamports: new BN(0.5 * LAMPORTS_PER_SOL),
    bundleWallets: [],
    slippageBps: 500,
    ...overrides,
  };
}

// ─── Intelligence Config ──────────────────────────────────────

export function createTestIntelligenceConfig(overrides?: Partial<IntelligenceConfig>): IntelligenceConfig {
  return {
    llmProvider: 'openrouter',
    llmApiKey: 'test-key',
    llmModel: 'openai/gpt-4o-mini',
    enableSignals: false,
    enableSentiment: false,
    riskTolerance: 0.5,
    maxAllocationPerToken: 0.2,
    ...overrides,
  };
}

// ─── Emergency Exit Config ────────────────────────────────────

export function createTestEmergencyExitConfig(overrides?: Partial<EmergencyExitConfig>): EmergencyExitConfig {
  return {
    maxLossLamports: new BN(2 * LAMPORTS_PER_SOL),
    maxLossPercent: 50,
    maxSilenceMs: 300_000,
    sellAllOnExit: true,
    reclaimOnExit: true,
    ...overrides,
  };
}

// ─── Full Master Config ──────────────────────────────────────

export function createTestConfig(overrides?: Partial<SwarmMasterConfig>): SwarmMasterConfig {
  const defaultAgentCounts: Record<AgentRole, number> = {
    creator: 1,
    trader: 3,
    analyst: 0,
    sniper: 0,
    market_maker: 0,
    volume_bot: 0,
    accumulator: 0,
    exit_manager: 1,
    sentinel: 0,
    scanner: 0,
    narrator: 0,
  };

  return {
    network: 'devnet',
    rpc: createTestRpcConfig(),
    wallets: createTestWalletConfig(),
    agentCounts: defaultAgentCounts,
    strategy: createTestStrategy(),
    token: createTestTokenConfig(),
    bundle: createTestBundleConfig(),
    intelligence: createTestIntelligenceConfig(),
    logLevel: 'error', // suppress noise in tests
    enableMetrics: false,
    emergencyExit: createTestEmergencyExitConfig(),
    ...overrides,
  };
}

// ─── Risk Limits ──────────────────────────────────────────────

export function createTestRiskLimits(overrides?: Partial<RiskLimits>): RiskLimits {
  return {
    maxPositionSize: 1.0,
    maxTotalDeployed: 5.0,
    maxPositionPercent: 0.25,
    stopLossPercent: 0.7,
    maxDrawdownPercent: 0.25,
    maxDrawdownSOL: 2.0,
    maxConcurrentPositions: 10,
    maxLossPerWindow: 1.0,
    lossWindowMs: 60 * 60 * 1000,
    circuitBreakerCooldown: 30 * 60 * 1000,
    maxConsecutiveLosses: 5,
    minTradeCooldown: 5_000,
    ...overrides,
  };
}

// ─── Anti-Detection Config ────────────────────────────────────

export function createTestAntiDetectionConfig(
  overrides?: Partial<AntiDetectionConfig>,
): AntiDetectionConfig {
  return {
    minAmountVariance: 0.05,
    maxAmountVariance: 0.15,
    timingJitterRange: [100, 500] as [number, number],
    maxTradesPerWalletPerHour: 6,
    maxTradesPerWalletPerDay: 48,
    enableNoiseTransactions: false,
    noiseProbability: 0.1,
    minWalletRotation: 3,
    avoidRoundNumbers: true,
    humanPatternEmulation: true,
    ...overrides,
  };
}

// ─── Utilities ────────────────────────────────────────────────

/**
 * Wait for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random Solana-like base58 address (44 chars).
 */
export function randomMint(): string {
  return Keypair.generate().publicKey.toBase58();
}

/**
 * Collect events from an EventBus into an array during a test.
 */
export function collectEvents(
  bus: SwarmEventBus,
  pattern = '*',
): { events: import('../../types.js').SwarmEvent[]; unsubscribe: () => void } {
  const events: import('../../types.js').SwarmEvent[] = [];
  const subId = bus.subscribe(pattern, (e) => {
    events.push(e);
  });
  return {
    events,
    unsubscribe: () => bus.unsubscribe(subId),
  };
}
