#!/usr/bin/env node
/**
 * Pump Agent Swarm CLI
 *
 * Run the swarm from the command line with full configuration.
 *
 * Usage:
 *   npx tsx src/cli.ts --name "My Token" --symbol "MTK" --metadata-uri "https://..." [options]
 *   npx pump-swarm --name "My Token" --symbol "MTK" --metadata-uri "https://..." [options]
 *
 * Examples:
 *   # Minimal (devnet, organic strategy, 3 traders)
 *   npx tsx src/cli.ts \
 *     --name "AI Agent Coin" \
 *     --symbol "AIAC" \
 *     --metadata-uri "https://arweave.net/abc123"
 *
 *   # Production (mainnet, graduation push, 5 traders, x402 analytics)
 *   npx tsx src/cli.ts \
 *     --rpc-url "https://your-rpc.com" \
 *     --name "Moon Token" \
 *     --symbol "MOON" \
 *     --metadata-uri "https://arweave.net/xyz789" \
 *     --strategy graduation \
 *     --traders 5 \
 *     --dev-buy 1.0 \
 *     --slippage 500 \
 *     --analytics-url "https://api.cryptovision.dev" \
 *     --x402-key "$X402_PRIVATE_KEY"
 *
 *   # Dry run (print config, don't execute)
 *   npx tsx src/cli.ts --name "Test" --symbol "TST" --metadata-uri "..." --dry-run
 */

import { SwarmCoordinator } from './swarm.js';
import { PRESET_STRATEGIES } from './strategies.js';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import BN from 'bn.js';
import type { SwarmConfig, TradingStrategy } from './types.js';

// ─── Arg Parsing ─────────────────────────────────────────────

interface CliArgs {
  rpcUrl: string;
  wsUrl?: string;
  name: string;
  symbol: string;
  metadataUri: string;
  strategy: string;
  traderCount: number;
  devBuySol: number;
  slippageBps: number;
  analyticsUrl?: string;
  x402Key?: string;
  devMode: boolean;
  dryRun: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  help: boolean;
  version: boolean;
}

function printUsage(): void {
  console.log(`
Pump Agent Swarm CLI — Pump.fun multi-agent trading bot

USAGE:
  pump-swarm [OPTIONS]

REQUIRED:
  --name <string>           Token name (e.g. "AI Agent Coin")
  --symbol <string>         Token symbol (e.g. "AIAC")
  --metadata-uri <string>   Arweave/IPFS URI for token metadata JSON

OPTIONS:
  --rpc-url <url>           Solana RPC endpoint (default: devnet)
  --ws-url <url>            Solana WebSocket endpoint
  --strategy <id>           Trading strategy: organic, volume, graduation, exit
                            (default: organic)
  --traders <n>             Number of trader agents (default: 3)
  --dev-buy <sol>           SOL amount for dev buy (default: 0.5)
  --slippage <bps>          Max slippage in basis points (default: 500 = 5%)
  --analytics-url <url>     x402 analytics API base URL
  --x402-key <key>          EVM private key for x402 payments
  --dev-mode                Skip real x402 payments (default: auto)
  --dry-run                 Print config and exit without executing
  --log-level <level>       Log level: debug, info, warn, error (default: info)
  --help, -h                Show this help message
  --version, -v             Show version

ENVIRONMENT VARIABLES:
  SOLANA_RPC_URL            Fallback for --rpc-url
  SOLANA_WS_URL             Fallback for --ws-url
  X402_PRIVATE_KEY          Fallback for --x402-key
  ANALYTICS_API_URL         Fallback for --analytics-url

STRATEGIES:
  organic      Slow, small buys with occasional sells. Looks natural.
               Trades: 30-120s interval, 0.01-0.05 SOL, 70% buy / 30% sell
  volume       High frequency balanced trading for volume generation.
               Trades: 5-20s interval, 0.02-0.1 SOL, 50% buy / 50% sell
  graduation   Aggressive buying to push toward 85 SOL graduation.
               Trades: 10-30s interval, 0.1-0.5 SOL, 90% buy / 10% sell
  exit         Fast sells after pump, taking profit.
               Trades: 3-10s interval, 0.05-0.2 SOL, 20% buy / 80% sell
`);
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    rpcUrl: process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com',
    wsUrl: process.env.SOLANA_WS_URL,
    name: '',
    symbol: '',
    metadataUri: '',
    strategy: 'organic',
    traderCount: 3,
    devBuySol: 0.5,
    slippageBps: 500,
    analyticsUrl: process.env.ANALYTICS_API_URL,
    x402Key: process.env.X402_PRIVATE_KEY,
    devMode: false,
    dryRun: false,
    logLevel: 'info',
    help: false,
    version: false,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    switch (arg) {
      case '--help':
      case '-h':
        args.help = true;
        break;

      case '--version':
      case '-v':
        args.version = true;
        break;

      case '--rpc-url':
        i++;
        args.rpcUrl = requireArg(argv, i, '--rpc-url');
        break;

      case '--ws-url':
        i++;
        args.wsUrl = requireArg(argv, i, '--ws-url');
        break;

      case '--name':
        i++;
        args.name = requireArg(argv, i, '--name');
        break;

      case '--symbol':
        i++;
        args.symbol = requireArg(argv, i, '--symbol');
        break;

      case '--metadata-uri':
        i++;
        args.metadataUri = requireArg(argv, i, '--metadata-uri');
        break;

      case '--strategy':
        i++;
        args.strategy = requireArg(argv, i, '--strategy');
        break;

      case '--traders':
        i++;
        args.traderCount = requireInt(argv, i, '--traders');
        break;

      case '--dev-buy':
        i++;
        args.devBuySol = requireFloat(argv, i, '--dev-buy');
        break;

      case '--slippage':
        i++;
        args.slippageBps = requireInt(argv, i, '--slippage');
        break;

      case '--analytics-url':
        i++;
        args.analyticsUrl = requireArg(argv, i, '--analytics-url');
        break;

      case '--x402-key':
        i++;
        args.x402Key = requireArg(argv, i, '--x402-key');
        break;

      case '--dev-mode':
        args.devMode = true;
        break;

      case '--dry-run':
        args.dryRun = true;
        break;

      case '--log-level':
        i++;
        args.logLevel = requireLogLevel(argv, i);
        break;

      default:
        // Unknown args are ignored with a warning
        console.warn(`[cli] Unknown argument: ${arg}`);
    }
    i++;
  }

  return args;
}

function requireArg(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) {
    console.error(`Error: ${flag} requires a value`);
    process.exit(1);
  }
  return value;
}

function requireInt(argv: string[], index: number, flag: string): number {
  const raw = requireArg(argv, index, flag);
  const n = parseInt(raw, 10);
  if (isNaN(n) || n <= 0) {
    console.error(`Error: ${flag} must be a positive integer, got "${raw}"`);
    process.exit(1);
  }
  return n;
}

function requireFloat(argv: string[], index: number, flag: string): number {
  const raw = requireArg(argv, index, flag);
  const n = parseFloat(raw);
  if (isNaN(n) || n <= 0) {
    console.error(`Error: ${flag} must be a positive number, got "${raw}"`);
    process.exit(1);
  }
  return n;
}

function requireLogLevel(argv: string[], index: number): CliArgs['logLevel'] {
  const raw = requireArg(argv, index, '--log-level');
  const valid = ['debug', 'info', 'warn', 'error'] as const;
  if (!valid.includes(raw as typeof valid[number])) {
    console.error(`Error: --log-level must be one of: ${valid.join(', ')}`);
    process.exit(1);
  }
  return raw as CliArgs['logLevel'];
}

// ─── Config Builder ──────────────────────────────────────────

function resolveStrategy(id: string): TradingStrategy {
  const strategy = PRESET_STRATEGIES[id];
  if (!strategy) {
    const available = Object.keys(PRESET_STRATEGIES).join(', ');
    console.error(`Error: Unknown strategy "${id}". Available: ${available}`);
    process.exit(1);
  }
  return strategy;
}

function buildSwarmConfig(args: CliArgs): SwarmConfig {
  return {
    rpcUrl: args.rpcUrl,
    wsUrl: args.wsUrl,
    traderCount: args.traderCount,
    token: {
      name: args.name,
      symbol: args.symbol,
      metadataUri: args.metadataUri,
    },
    bundle: {
      devBuyLamports: new BN(Math.floor(args.devBuySol * LAMPORTS_PER_SOL)),
      bundleWallets: [],
      slippageBps: args.slippageBps,
    },
    strategy: resolveStrategy(args.strategy),
    analyticsApiUrl: args.analyticsUrl,
    x402PrivateKey: args.x402Key,
    devMode: args.devMode || !args.x402Key,
    logLevel: args.logLevel,
  };
}

function validateArgs(args: CliArgs): void {
  const missing: string[] = [];
  if (!args.name) missing.push('--name');
  if (!args.symbol) missing.push('--symbol');
  if (!args.metadataUri) missing.push('--metadata-uri');

  if (missing.length > 0) {
    console.error(`Error: Missing required arguments: ${missing.join(', ')}`);
    console.error('Run with --help for usage information.');
    process.exit(1);
  }

  if (args.traderCount < 1 || args.traderCount > 20) {
    console.error('Error: --traders must be between 1 and 20');
    process.exit(1);
  }

  if (args.devBuySol < 0.001) {
    console.error('Error: --dev-buy must be at least 0.001 SOL');
    process.exit(1);
  }

  if (args.slippageBps < 1 || args.slippageBps > 10_000) {
    console.error('Error: --slippage must be between 1 and 10000 BPS');
    process.exit(1);
  }
}

// ─── Display Helpers ─────────────────────────────────────────

function printConfig(config: SwarmConfig): void {
  const devBuySol = config.bundle.devBuyLamports.toNumber() / LAMPORTS_PER_SOL;

  console.log('\n' + '='.repeat(60));
  console.log('  PUMP AGENT SWARM — CONFIGURATION');
  console.log('='.repeat(60));
  console.log(`  RPC:          ${config.rpcUrl}`);
  if (config.wsUrl) {
    console.log(`  WebSocket:    ${config.wsUrl}`);
  }
  console.log('');
  console.log('  Token:');
  console.log(`    Name:       ${config.token.name}`);
  console.log(`    Symbol:     $${config.token.symbol}`);
  console.log(`    Metadata:   ${config.token.metadataUri}`);
  console.log('');
  console.log('  Trading:');
  console.log(`    Strategy:   ${config.strategy.name} (${config.strategy.id})`);
  console.log(`    Traders:    ${config.traderCount}`);
  console.log(`    Dev buy:    ${devBuySol} SOL`);
  console.log(`    Slippage:   ${config.bundle.slippageBps} BPS (${(config.bundle.slippageBps / 100).toFixed(1)}%)`);
  console.log(`    Budget:     ${(config.strategy.maxTotalBudgetLamports.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL per trader`);
  console.log(`    Interval:   ${config.strategy.minIntervalSeconds}-${config.strategy.maxIntervalSeconds}s`);
  console.log(`    Trade size: ${(config.strategy.minTradeSizeLamports.toNumber() / LAMPORTS_PER_SOL).toFixed(4)}-${(config.strategy.maxTradeSizeLamports.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  if (config.strategy.maxTrades) {
    console.log(`    Max trades: ${config.strategy.maxTrades}`);
  }
  if (config.strategy.maxDurationSeconds) {
    console.log(`    Max time:   ${config.strategy.maxDurationSeconds}s`);
  }
  console.log('');
  console.log('  Analytics:');
  if (config.analyticsApiUrl) {
    console.log(`    API:        ${config.analyticsApiUrl}`);
    console.log(`    x402:       ${config.devMode ? 'dev mode (no real payments)' : 'LIVE payments'}`);
  } else {
    console.log('    Not configured (running without paid analytics)');
  }
  console.log('='.repeat(60) + '\n');
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

// ─── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (args.version) {
    console.log('@nirholas/pump-agent-swarm v0.1.0');
    process.exit(0);
  }

  validateArgs(args);

  const config = buildSwarmConfig(args);
  printConfig(config);

  if (args.dryRun) {
    console.log('[cli] Dry run — exiting without executing.\n');
    process.exit(0);
  }

  // ─── Create and wire up the swarm ─────────────────────────

  const swarm = new SwarmCoordinator(config);

  // Phase changes
  swarm.on('phase:change', (phase) => {
    console.log(`\n>>> Phase: ${phase.toUpperCase()}\n`);
  });

  // Token creation
  swarm.on('token:created', (result) => {
    console.log(`[created] Mint:           ${result.mint}`);
    console.log(`[created] Bonding curve:  ${result.bondingCurve}`);
    console.log(`[created] Signature:      ${result.signature}`);
    if (result.devBuyTokens) {
      console.log(`[created] Dev buy tokens: ${result.devBuyTokens.toString()}`);
    }
  });

  // Trade execution
  swarm.on('trade:executed', (result) => {
    const dir = result.order.direction === 'buy' ? 'BUY ' : 'SELL';
    const amount = result.order.direction === 'buy'
      ? `${(result.order.amount.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL`
      : `${result.order.amount.toString()} tokens`;
    const status = result.success ? 'OK' : 'FAIL';
    const sig = result.signature.slice(0, 8);
    console.log(`  [${result.order.traderId}] ${dir} ${amount} — ${status} (${sig}...)`);
  });

  // Trade failures
  swarm.on('trade:failed', (order, error) => {
    console.error(`  [${order.traderId}] FAILED ${order.direction} — ${error.message}`);
  });

  // x402 analytics payments
  swarm.on('analytics:x402-payment', (amount, endpoint) => {
    console.log(`  [x402] Payment: ${amount} USDC -> ${endpoint}`);
  });

  // Analytics data
  swarm.on('analytics:fetched', (analytics) => {
    const bc = analytics.bondingCurve;
    console.log(
      `  [analytics] price=${bc.currentPriceSol.toFixed(8)} SOL, ` +
      `mcap=${bc.marketCapSol.toFixed(2)} SOL, ` +
      `holders=${analytics.holderCount}, ` +
      `rug=${analytics.rugScore}/100, ` +
      `grad=${bc.graduationProgress.toFixed(1)}%`,
    );
  });

  // Graduation
  swarm.on('curve:graduated', (mint) => {
    console.log(`\n  *** TOKEN GRADUATED! Mint: ${mint} ***\n`);
  });

  // Budget exhaustion
  swarm.on('budget:exhausted', (traderId) => {
    console.log(`  [${traderId}] Budget exhausted — stopping`);
  });

  // Errors
  swarm.on('error', (error) => {
    console.error(`[error] ${error.message}`);
  });

  // ─── Graceful shutdown ────────────────────────────────────

  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[cli] Received ${signal}, stopping swarm...`);

    try {
      const status = await swarm.stop();
      const pnl = status.netPnlSol.toNumber() / LAMPORTS_PER_SOL;
      console.log(`[cli] Final P&L: ${pnl.toFixed(4)} SOL`);
      console.log(`[cli] Duration: ${formatDuration(status.uptimeSeconds)}`);
    } catch (err) {
      console.error('[cli] Error during shutdown:', err);
    }

    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  // ─── Run ──────────────────────────────────────────────────

  console.log('[cli] Starting Pump.fun Agent Swarm...\n');
  const startTime = Date.now();

  try {
    const finalStatus = await swarm.run();
    const duration = formatDuration(finalStatus.uptimeSeconds);
    const pnl = finalStatus.netPnlSol.toNumber() / LAMPORTS_PER_SOL;

    console.log('\n[cli] Swarm completed successfully.');
    console.log(`[cli] Duration:        ${duration}`);
    console.log(`[cli] Total trades:    ${finalStatus.totalTrades} (${finalStatus.successfulTrades} ok, ${finalStatus.failedTrades} failed)`);
    console.log(`[cli] Net P&L:         ${pnl >= 0 ? '+' : ''}${pnl.toFixed(4)} SOL`);
    console.log(`[cli] Active traders:  ${finalStatus.activeTraders}`);

    if (finalStatus.x402PaymentsMade > 0) {
      console.log(`[cli] x402 payments:   ${finalStatus.x402PaymentsMade} calls, $${finalStatus.x402TotalSpentUsdc.toFixed(4)} USDC`);
    }

    if (finalStatus.currentMarketCapSol !== undefined) {
      console.log(`[cli] Market cap:      ${finalStatus.currentMarketCapSol.toFixed(2)} SOL`);
      console.log(`[cli] Graduation:      ${finalStatus.graduationProgress?.toFixed(1)}%`);
    }

    process.exit(0);
  } catch (error) {
    const elapsed = formatDuration((Date.now() - startTime) / 1000);
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`\n[cli] Swarm failed after ${elapsed}: ${err.message}`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error(`[cli] Fatal: ${error.message}`);
  process.exit(1);
});
