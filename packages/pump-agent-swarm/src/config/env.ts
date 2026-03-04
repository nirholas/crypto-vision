/**
 * Environment Variable Loader
 *
 * Reads all swarm configuration from environment variables and returns
 * a fully typed SwarmMasterConfig. No .env file parsing — that's the
 * caller's responsibility (dotenv, Docker, etc.)
 */

import BN from 'bn.js';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import type {
  SwarmMasterConfig,
  RpcEndpoint,
  AgentRole,
} from '../types.js';
import { PRESET_STRATEGIES } from '../strategies.js';
import {
  DEFAULT_RPC_CONFIG,
  DEFAULT_WALLET_CONFIG,
  DEFAULT_BUNDLE_CONFIG,
  DEFAULT_INTELLIGENCE_CONFIG,
  DEFAULT_DASHBOARD_CONFIG,
  DEFAULT_EMERGENCY_EXIT_CONFIG,
  DEFAULT_ANALYTICS_CONFIG,
  DEFAULT_AGENT_COUNTS,
} from './defaults.js';

// ─── Helpers ──────────────────────────────────────────────────

function envStr(key: string, fallback?: string): string {
  const val = process.env[key];
  if (val !== undefined && val !== '') return val;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${key}`);
}

function envStrOpt(key: string): string | undefined {
  const val = process.env[key];
  return val !== undefined && val !== '' ? val : undefined;
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be an integer, got: ${raw}`);
  }
  return parsed;
}

function envFloat(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = parseFloat(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number, got: ${raw}`);
  }
  return parsed;
}

function envBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function solToLamports(sol: number): BN {
  return new BN(Math.round(sol * LAMPORTS_PER_SOL));
}

// ─── RPC Endpoint Builder ─────────────────────────────────────

function buildRpcEndpoints(): RpcEndpoint[] {
  const primary = envStr('SOLANA_RPC_URL');
  const endpoints: RpcEndpoint[] = [
    {
      url: primary,
      weight: 10,
      rateLimit: 50,
      supportsJito: false,
      provider: 'primary',
      healthy: true,
      avgLatencyMs: 0,
      errorCount: 0,
      lastSuccessAt: Date.now(),
    },
  ];

  const secondary = envStrOpt('SOLANA_RPC_URL_2');
  if (secondary) {
    endpoints.push({
      url: secondary,
      weight: 5,
      rateLimit: 50,
      supportsJito: false,
      provider: 'secondary',
      healthy: true,
      avgLatencyMs: 0,
      errorCount: 0,
      lastSuccessAt: Date.now(),
    });
  }

  const tertiary = envStrOpt('SOLANA_RPC_URL_3');
  if (tertiary) {
    endpoints.push({
      url: tertiary,
      weight: 3,
      rateLimit: 50,
      supportsJito: false,
      provider: 'tertiary',
      healthy: true,
      avgLatencyMs: 0,
      errorCount: 0,
      lastSuccessAt: Date.now(),
    });
  }

  return endpoints;
}

// ─── Main Loader ──────────────────────────────────────────────

/**
 * Load all swarm configuration from environment variables.
 * Returns a fully populated SwarmMasterConfig with defaults
 * applied for any unset optional vars.
 */
export function loadSwarmConfigFromEnv(): SwarmMasterConfig {
  const network = envStr('SOLANA_NETWORK', 'mainnet-beta') as 'mainnet-beta' | 'devnet';
  const traderCount = envInt('TRADER_COUNT', 5);
  const logLevel = envStr('LOG_LEVEL', 'info') as 'debug' | 'info' | 'warn' | 'error';

  // Build agent counts with env override for trader count
  const agentCounts: Record<AgentRole, number> = {
    ...DEFAULT_AGENT_COUNTS,
    trader: traderCount,
  };

  // RPC configuration
  const rpcEndpoints = buildRpcEndpoints();
  const rpc = {
    ...DEFAULT_RPC_CONFIG,
    endpoints: rpcEndpoints,
  };

  // Wallet configuration
  const masterSeed = envStrOpt('MASTER_SEED_PHRASE');
  const wallets = {
    ...DEFAULT_WALLET_CONFIG,
    masterSeed,
    poolSize: traderCount + 2, // traders + creator + fee recipient
  };

  // Token configuration (optional — may be scanning instead)
  const tokenName = envStrOpt('TOKEN_NAME');
  const tokenSymbol = envStrOpt('TOKEN_SYMBOL');
  const tokenMetadataUri = envStrOpt('TOKEN_METADATA_URI');
  const token = tokenName && tokenSymbol && tokenMetadataUri
    ? { name: tokenName, symbol: tokenSymbol, metadataUri: tokenMetadataUri }
    : undefined;

  // Bundle configuration
  const devBuySol = envFloat('DEV_BUY_SOL', 0.5);
  const bundle = {
    ...DEFAULT_BUNDLE_CONFIG,
    devBuyLamports: solToLamports(devBuySol),
    // Bundle wallets are assigned at runtime by the coordinator.
    // We store the desired size for the coordinator to populate.
    bundleWallets: [] as typeof DEFAULT_BUNDLE_CONFIG.bundleWallets,
    slippageBps: envInt('BUNDLE_SLIPPAGE_BPS', DEFAULT_BUNDLE_CONFIG.slippageBps),
  };

  // Strategy — resolve from presets, fail loudly on unknown
  const strategyName = envStr('STRATEGY', 'organic');
  const strategy = PRESET_STRATEGIES[strategyName];
  if (!strategy) {
    throw new Error(
      `Unknown strategy "${strategyName}". Available: ${Object.keys(PRESET_STRATEGIES).join(', ')}`,
    );
  }

  // Intelligence configuration
  const llmProvider = envStr('LLM_PROVIDER', 'openrouter') as 'openai' | 'anthropic' | 'openrouter';
  const llmApiKey = envStrOpt('LLM_API_KEY') ?? envStrOpt('OPENROUTER_API_KEY') ?? '';
  const llmModel = envStr('LLM_MODEL', 'anthropic/claude-sonnet-4');
  const intelligence = {
    ...DEFAULT_INTELLIGENCE_CONFIG,
    llmProvider,
    llmApiKey,
    llmModel,
  };

  // Dashboard configuration
  const dashboardPort = envInt('DASHBOARD_PORT', 8080);
  const dashboardAuthToken = envStrOpt('DASHBOARD_AUTH_TOKEN');
  const dashboard = {
    ...DEFAULT_DASHBOARD_CONFIG,
    port: dashboardPort,
    authToken: dashboardAuthToken,
  };

  // Analytics (x402 — Solana-native USDC payments)
  const x402ApiUrl = envStrOpt('X402_API_URL');
  const x402SolanaKey = envStrOpt('X402_SOLANA_PRIVATE_KEY') ?? envStrOpt('MASTER_SEED_PHRASE');
  const x402Network = network;
  const analytics = x402ApiUrl
    ? {
        ...DEFAULT_ANALYTICS_CONFIG,
        apiBaseUrl: x402ApiUrl,
        solanaPrivateKey: x402SolanaKey,
        network: x402Network,
      }
    : undefined;

  // Emergency exit
  const maxLossSol = envFloat('MAX_LOSS_SOL', 5.0);
  const maxLossPercent = envFloat('MAX_LOSS_PERCENT', 50);
  const emergencyExit = {
    ...DEFAULT_EMERGENCY_EXIT_CONFIG,
    maxLossLamports: solToLamports(maxLossSol),
    maxLossPercent,
  };

  // Jito configuration — mark RPC endpoints as Jito-capable
  const jitoBlockEngineUrl = envStrOpt('JITO_BLOCK_ENGINE_URL');
  if (jitoBlockEngineUrl) {
    rpcEndpoints[0].supportsJito = true;
  }

  // Metrics enabled by default
  const enableMetrics = envBool('ENABLE_METRICS', true);

  // Validate network value
  if (network !== 'mainnet-beta' && network !== 'devnet') {
    throw new Error(`Invalid SOLANA_NETWORK: "${network}". Must be "mainnet-beta" or "devnet"`);
  }

  // Validate log level
  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLogLevels.includes(logLevel)) {
    throw new Error(`Invalid LOG_LEVEL: "${logLevel}". Must be one of: ${validLogLevels.join(', ')}`);
  }

  return {
    network,
    rpc,
    wallets,
    agentCounts,
    strategy,
    token,
    bundle,
    intelligence,
    dashboard,
    analytics,
    logLevel,
    enableMetrics,
    emergencyExit,
  };
}
