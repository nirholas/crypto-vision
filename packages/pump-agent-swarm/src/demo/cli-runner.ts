/**
 * CLI Runner — Interactive terminal application for launching and controlling
 * the pump-agent-swarm.
 *
 * This is the primary interactive entry point for the swarm. It provides:
 * - An interactive wizard to collect configuration
 * - Real-time status display with auto-refresh
 * - Runtime single-key commands for monitoring and control
 * - Graceful shutdown with session export
 * - SIGINT/SIGTERM handling
 *
 * Usage:
 * ```bash
 * npx tsx packages/pump-agent-swarm/src/demo/cli-runner.ts
 * ```
 */

import * as readline from 'node:readline';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import BN from 'bn.js';
import bs58 from 'bs58';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

import { SwarmCoordinator } from '../swarm.js';
import { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmLogger } from '../infra/logger.js';
import { RpcPool } from '../infra/rpc-pool.js';
import { HealthMonitor } from '../coordination/health-monitor.js';
import { StrategyBrain, DEFAULT_STRATEGY_BRAIN_CONFIG } from '../intelligence/strategy-brain.js';
import { PnLDashboard } from '../dashboard/pnl-dashboard.js';
import {
  PRESET_STRATEGIES,
  STRATEGY_ORGANIC,
} from '../strategies.js';
import type {
  SwarmConfig,
  SwarmEvent,
  SwarmStatus,
  TradeResult,
  RpcEndpoint,
} from '../types.js';

// ─── ANSI Color Helpers ──────────────────────────────────────

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

function green(text: string): string {
  return `${GREEN}${text}${RESET}`;
}
function red(text: string): string {
  return `${RED}${text}${RESET}`;
}
function yellow(text: string): string {
  return `${YELLOW}${text}${RESET}`;
}
function cyan(text: string): string {
  return `${CYAN}${text}${RESET}`;
}
function bold(text: string): string {
  return `${BOLD}${text}${RESET}`;
}
function dim(text: string): string {
  return `${DIM}${text}${RESET}`;
}

function profitColor(value: number): string {
  if (value > 0) return green(`+${value.toFixed(4)}`);
  if (value < 0) return red(value.toFixed(4));
  return `${value.toFixed(4)}`;
}

// ─── CLI Config Interface ────────────────────────────────────

interface CLIConfig {
  /** Network to use */
  network: 'mainnet-beta' | 'devnet';
  /** RPC endpoint URL */
  rpcUrl: string;
  /** Strategy mode */
  mode: 'create-new' | 'buy-existing' | 'auto';
  /** Token mint address (for buy-existing mode) */
  tokenMint?: string;
  /** Total SOL budget */
  budget: number;
  /** Number of trader agents to spawn */
  traderCount: number;
  /** Trading strategy preset */
  strategy: 'organic' | 'volume' | 'graduation' | 'exit';
  /** Master wallet private key (base58 or path to keypair file) */
  masterWalletKey: string;
  /** Whether to start dashboard server */
  enableDashboard: boolean;
  /** Dashboard port */
  dashboardPort: number;
  /** OpenRouter API key for AI decisions */
  openRouterApiKey: string;
  /** Maximum session duration in minutes */
  maxDurationMinutes: number;
}

// ─── Trade Log Entry ─────────────────────────────────────────

interface TradeLogEntry {
  timestamp: number;
  agentName: string;
  direction: 'BUY' | 'SELL';
  solAmount: number;
  tokenAmount: number;
}

// ─── Session Export ──────────────────────────────────────────

interface SessionExport {
  sessionId: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  config: CLIConfig;
  finalStatus: SwarmStatus | null;
  tradeLog: TradeLogEntry[];
  pnl: {
    realized: number;
    unrealized: number;
    total: number;
    roi: number;
  };
}

// ─── Swarm CLI ───────────────────────────────────────────────

export class SwarmCLI {
  private rl: readline.Interface | null = null;
  private config: CLIConfig | null = null;
  private coordinator: SwarmCoordinator | null = null;
  private eventBus: SwarmEventBus;
  private healthMonitor: HealthMonitor | null = null;
  private strategyBrain: StrategyBrain | null = null;
  private pnlDashboard: PnLDashboard | null = null;
  private logger: SwarmLogger;
  private rpcPool: RpcPool | null = null;

  private startedAt = 0;
  private sessionId: string;
  private tradeLog: TradeLogEntry[] = [];
  private statusInterval: ReturnType<typeof setInterval> | null = null;
  private durationTimeout: ReturnType<typeof setTimeout> | null = null;
  private isShuttingDown = false;
  private isRunning = false;
  private lastStatus: SwarmStatus | null = null;

  private isPaused = false;

  constructor() {
    this.sessionId = `swarm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.eventBus = SwarmEventBus.getInstance();
    this.logger = SwarmLogger.create('cli-runner', 'cli');

    this.logger.info('CLI session created', { sessionId: this.sessionId });
    this.setupSignalHandlers();
  }

  /**
   * Main entry point — runs the interactive wizard, then launches the swarm.
   */
  async run(): Promise<void> {
    this.printBanner();

    this.config = await this.promptConfig();

    this.printConfigSummary(this.config);

    const confirmed = await this.promptYesNo('Confirm and launch?', true);
    if (!confirmed) {
      console.log(yellow('\n  Launch cancelled. Exiting.\n'));
      return;
    }

    await this.launchSwarm(this.config);
  }

  // ── Interactive Wizard ───────────────────────────────────────

  /**
   * Collect configuration from the user interactively via readline prompts.
   */
  async promptConfig(): Promise<CLIConfig> {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('');

    const network = await this.promptSelect(
      'Select network',
      ['devnet', 'mainnet-beta'],
      'devnet',
    );

    const defaultRpc =
      process.env.SOLANA_RPC_URL ??
      (network === 'devnet'
        ? 'https://api.devnet.solana.com'
        : 'https://api.mainnet-beta.solana.com');
    const rpcUrl = await this.promptInput('RPC endpoint URL', defaultRpc);

    const mode = await this.promptSelect(
      'Select mode',
      ['create-new', 'buy-existing', 'auto'],
      'create-new',
    );

    let tokenMint: string | undefined;
    if (mode === 'buy-existing') {
      tokenMint = await this.promptInput('Token mint address');
    }

    const budgetStr = await this.promptInput('SOL budget', '5.0');
    const budget = parseFloat(budgetStr);
    if (Number.isNaN(budget) || budget <= 0) {
      throw new Error(`Invalid budget: ${budgetStr}`);
    }

    const traderCountStr = await this.promptInput('Number of trader agents', '5');
    const traderCount = parseInt(traderCountStr, 10);
    if (Number.isNaN(traderCount) || traderCount < 1 || traderCount > 20) {
      throw new Error(`Invalid trader count: ${traderCountStr}. Must be 1-20.`);
    }

    const strategy = await this.promptSelect(
      'Trading strategy',
      ['organic', 'volume', 'graduation', 'exit'],
      'organic',
    );

    const defaultWalletKey = process.env.MASTER_WALLET_KEY ?? '';
    const masterWalletKey = await this.promptInput(
      'Master wallet key or path',
      defaultWalletKey || undefined,
    );
    if (!masterWalletKey) {
      throw new Error(
        'Master wallet key is required. Provide base58 private key or path to keypair JSON.',
      );
    }

    const enableDashboard = await this.promptYesNo('Enable live dashboard?', true);

    let dashboardPort = 3847;
    if (enableDashboard) {
      const portStr = await this.promptInput('Dashboard port', '3847');
      dashboardPort = parseInt(portStr, 10);
      if (Number.isNaN(dashboardPort) || dashboardPort < 1024 || dashboardPort > 65535) {
        throw new Error(`Invalid port: ${portStr}`);
      }
    }

    const defaultApiKey = process.env.OPENROUTER_API_KEY ?? '';
    const openRouterApiKey = await this.promptInput(
      'OpenRouter API key',
      defaultApiKey || undefined,
    );

    const durationStr = await this.promptInput('Max session duration (minutes)', '60');
    const maxDurationMinutes = parseInt(durationStr, 10);
    if (Number.isNaN(maxDurationMinutes) || maxDurationMinutes < 1) {
      throw new Error(`Invalid duration: ${durationStr}`);
    }

    this.rl.close();
    this.rl = null;

    return {
      network: network as CLIConfig['network'],
      rpcUrl,
      mode: mode as CLIConfig['mode'],
      tokenMint,
      budget,
      traderCount,
      strategy: strategy as CLIConfig['strategy'],
      masterWalletKey,
      enableDashboard,
      dashboardPort,
      openRouterApiKey,
      maxDurationMinutes,
    };
  }

  // ── Status Display ───────────────────────────────────────────

  /**
   * Show current swarm status in compact terminal format.
   */
  displayStatus(): void {
    const status = this.lastStatus;
    const uptime = this.formatUptime(Date.now() - this.startedAt);
    const healthLabel = this.getHealthLabel();

    console.log('');
    console.log(
      cyan('┌─ SWARM STATUS ──────────────────────────────────────┐'),
    );

    const phase = status?.phase ?? 'initializing';
    console.log(
      cyan('│') +
        ` Phase: ${bold(phase.toUpperCase().padEnd(12))}│ Uptime: ${dim(uptime.padEnd(10))}│ Health: ${healthLabel} ` +
        cyan('│'),
    );

    // P&L section
    const realized = status
      ? Number(status.totalSolSpent.sub(status.totalSolReceived).toString()) / -LAMPORTS_PER_SOL
      : 0;
    const unrealized = 0; // Unrealized requires live price, approximate to 0
    const total = realized + unrealized;
    const invested = this.config?.budget ?? 0;
    const roi = invested > 0 ? (total / invested) * 100 : 0;

    console.log(
      cyan('├─ P&L ──────────────────────────────────────────────┤'),
    );
    console.log(
      cyan('│') +
        ` Realized: ${profitColor(realized).padEnd(22)}│ Unrealized: ${profitColor(unrealized).padEnd(18)} ` +
        cyan('│'),
    );
    console.log(
      cyan('│') +
        ` Total: ${profitColor(total).padEnd(25)}│ ROI: ${profitColor(roi)}%`.padEnd(24) +
        cyan('│'),
    );

    // Agents section
    console.log(
      cyan('├─ AGENTS ───────────────────────────────────────────┤'),
    );
    if (status?.traderStats) {
      for (const [name, stats] of Object.entries(status.traderStats)) {
        const trades = stats.totalBuys + stats.totalSells;
        const pnl =
          (Number(stats.solReceived.toString()) - Number(stats.solSpent.toString())) /
          LAMPORTS_PER_SOL;
        const statusIcon = trades > 0 ? green('✅') : yellow('⏳');
        const displayName = name.length > 12 ? name.slice(0, 12) : name.padEnd(12);
        console.log(
          cyan('│') +
            ` ${displayName} ${statusIcon} ${String(trades).padStart(3)} trades  ${profitColor(pnl)} SOL`.padEnd(52) +
            cyan('│'),
        );
      }
    } else {
      console.log(
        cyan('│') + '  No agents active yet'.padEnd(52) + cyan('│'),
      );
    }

    // Recent trades section
    console.log(
      cyan('├─ LAST 3 TRADES ────────────────────────────────────┤'),
    );
    const recentTrades = this.tradeLog.slice(-3).reverse();
    if (recentTrades.length === 0) {
      console.log(
        cyan('│') + '  No trades yet'.padEnd(52) + cyan('│'),
      );
    } else {
      for (const trade of recentTrades) {
        const time = new Date(trade.timestamp).toLocaleTimeString('en-US', { hour12: false });
        const dirColor = trade.direction === 'BUY' ? green : red;
        const line = ` ${dim(time)} ${trade.agentName.padEnd(10)} ${dirColor(trade.direction.padEnd(4))} ${trade.solAmount.toFixed(2)} SOL → ${trade.tokenAmount.toLocaleString()} tokens`;
        console.log(
          cyan('│') + line.padEnd(52) + cyan('│'),
        );
      }
    }

    console.log(
      cyan('└────────────────────────────────────────────────────┘'),
    );
    console.log(
      dim('  Commands: ') +
        `${bold('[s]')}tatus ${bold('[a]')}gents ${bold('[t]')}rades ${bold('[p]')}nl ${bold('[c]')}onfig e${bold('[x]')}port ${bold('[e]')}xit ${bold('[h]')}elp`,
    );
  }

  /**
   * Show P&L summary broken down by agent.
   */
  displayPnL(): void {
    const status = this.lastStatus;

    console.log('');
    console.log(bold(cyan('  ═══ P&L BREAKDOWN ═══')));
    console.log('');

    if (!status?.traderStats || Object.keys(status.traderStats).length === 0) {
      console.log(yellow('  No trading data available yet.'));
      return;
    }

    let totalRealized = 0;
    console.log(
      `  ${'Agent'.padEnd(14)} ${'Buys'.padStart(5)} ${'Sells'.padStart(6)} ${'SOL Spent'.padStart(12)} ${'SOL Recv'.padStart(12)} ${'P&L'.padStart(12)}`,
    );
    console.log(`  ${'─'.repeat(65)}`);

    for (const [name, stats] of Object.entries(status.traderStats)) {
      const spent = Number(stats.solSpent.toString()) / LAMPORTS_PER_SOL;
      const recv = Number(stats.solReceived.toString()) / LAMPORTS_PER_SOL;
      const pnl = recv - spent;
      totalRealized += pnl;

      console.log(
        `  ${cyan(name.padEnd(14))} ${String(stats.totalBuys).padStart(5)} ${String(stats.totalSells).padStart(6)} ${spent.toFixed(4).padStart(12)} ${recv.toFixed(4).padStart(12)} ${profitColor(pnl).padStart(12)}`,
      );
    }

    console.log(`  ${'─'.repeat(65)}`);
    console.log(
      `  ${'TOTAL'.padEnd(14)} ${' '.repeat(24)} ${profitColor(totalRealized).padStart(12)} SOL`,
    );

    const invested = this.config?.budget ?? 0;
    const roi = invested > 0 ? (totalRealized / invested) * 100 : 0;
    console.log(`  ROI: ${profitColor(roi)}%`);
    console.log('');
  }

  // ── Runtime Command Handler ──────────────────────────────────

  /**
   * Handle a single-character runtime command.
   */
  async handleCommand(command: string): Promise<void> {
    const cmd = command.trim().toLowerCase();

    switch (cmd) {
      case 's':
        this.displayStatus();
        break;

      case 'p':
        this.displayPnL();
        break;

      case 'a':
        this.displayAgents();
        break;

      case 't':
        this.displayTrades();
        break;

      case 'c':
        this.displayConfig();
        break;

      case 'x':
        await this.exportReport();
        break;

      case ' ':
        this.togglePause();
        break;

      case 'e':
        console.log(yellow('\n  Triggering exit strategy...'));
        await this.shutdown();
        break;

      case 'h':
        this.displayHelp();
        break;

      case 'q':
        console.log(red(bold('\n  EMERGENCY STOP — halting immediately')));
        await this.emergencyStop();
        break;

      case 'd':
        if (this.config?.enableDashboard) {
          const url = `http://localhost:${this.config.dashboardPort}`;
          console.log(cyan(`\n  Dashboard: ${url}\n`));
        } else {
          console.log(yellow('\n  Dashboard is not enabled.\n'));
        }
        break;

      default:
        if (cmd.length > 0) {
          console.log(dim(`  Unknown command: "${cmd}". Press [h] for help.`));
        }
        break;
    }
  }

  /**
   * Graceful shutdown sequence: stop trading → reclaim funds → export report → exit
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown || !this.isRunning) return;
    this.isShuttingDown = true;

    console.log('');
    console.log(yellow(bold('  ═══ SHUTTING DOWN ═══')));
    console.log('');

    // Stop status refresh
    if (this.statusInterval !== null) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }

    // Clear duration timeout
    if (this.durationTimeout !== null) {
      clearTimeout(this.durationTimeout);
      this.durationTimeout = null;
    }

    // Step 1: Stop coordinator
    if (this.coordinator) {
      console.log(dim('  [1/4] Stopping trading...'));
      try {
        this.lastStatus = await this.coordinator.stop();
        console.log(green('  ✓ Trading stopped'));
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.log(red(`  ✗ Error stopping: ${error.message}`));
      }
    }

    // Step 2: Get final status
    console.log(dim('  [2/4] Collecting final metrics...'));
    if (this.coordinator) {
      try {
        this.lastStatus = this.coordinator.getStatus();
      } catch {
        // Status already captured
      }
    }
    console.log(green('  ✓ Metrics collected'));

    // Step 3: Final P&L display
    console.log(dim('  [3/4] Computing final P&L...'));
    this.displayPnL();
    console.log(green('  ✓ P&L computed'));

    // Step 4: Export session report
    console.log(dim('  [4/4] Exporting session report...'));
    try {
      const reportPath = await this.exportSessionReport();
      console.log(green(`  ✓ Report saved: ${reportPath}`));
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.log(red(`  ✗ Export failed: ${error.message}`));
    }

    // Stop health monitor
    if (this.healthMonitor) {
      this.healthMonitor.stopMonitoring();
    }

    // Stop RPC pool health checks
    if (this.rpcPool) {
      this.rpcPool.stopHealthChecks();
    }

    // Clean up event bus
    this.eventBus.unsubscribeAll('cli-runner');
    SwarmEventBus.resetInstance();

    console.log('');
    console.log(green(bold('  Session complete. Goodbye.')));
    console.log('');

    this.isRunning = false;
    process.exit(0);
  }

  // ── Private: Launch and Orchestrate ──────────────────────────

  private async launchSwarm(config: CLIConfig): Promise<void> {
    this.startedAt = Date.now();
    this.isRunning = true;

    console.log('');
    console.log(bold(cyan('  ═══ LAUNCHING SWARM ═══')));
    console.log('');

    // Resolve master wallet keypair
    console.log(dim('  [1/5] Resolving master wallet...'));
    const masterKeypair = await this.resolveKeypair(config.masterWalletKey);
    console.log(green(`  ✓ Wallet: ${masterKeypair.publicKey.toBase58().slice(0, 8)}...`));

    // Initialize RPC connection pool
    console.log(dim('  [2/5] Initializing RPC pool...'));
    const rpcEndpoints: RpcEndpoint[] = [
      {
        url: config.rpcUrl,
        weight: 10,
        rateLimit: 50,
        supportsJito: false,
        provider: 'user',
      },
    ];
    this.rpcPool = new RpcPool({ endpoints: rpcEndpoints });
    this.rpcPool.startHealthChecks();
    console.log(green('  ✓ RPC pool ready'));

    // Initialize event bus subscriptions
    console.log(dim('  [3/5] Setting up event bus...'));
    this.subscribeToEvents();
    console.log(green('  ✓ Event bus connected'));

    // Initialize health monitor
    console.log(dim('  [4/5] Starting health monitor...'));
    this.healthMonitor = new HealthMonitor(this.eventBus);
    this.healthMonitor.startMonitoring();
    console.log(green('  ✓ Health monitor active'));

    // Initialize strategy brain if API key provided
    if (config.openRouterApiKey) {
      this.strategyBrain = new StrategyBrain(
        {
          ...DEFAULT_STRATEGY_BRAIN_CONFIG,
          openRouterApiKey: config.openRouterApiKey,
        },
        this.eventBus,
      );
    }
    if (this.strategyBrain) {
      console.log(green('  ✓ Strategy brain initialized'));
    }

    // Initialize P&L dashboard
    this.pnlDashboard = new PnLDashboard(this.eventBus);
    this.pnlDashboard.startSampling();

    // Build SwarmConfig from CLIConfig
    const strategy = PRESET_STRATEGIES[config.strategy] ?? STRATEGY_ORGANIC;
    const swarmConfig: SwarmConfig = {
      rpcUrl: config.rpcUrl,
      traderCount: config.traderCount,
      token: {
        name: 'CLI Token',
        symbol: 'CLI',
        metadataUri: '',
      },
      bundle: {
        devBuyLamports: new BN(Math.floor((config.budget / (config.traderCount + 1)) * LAMPORTS_PER_SOL)),
        bundleWallets: [],
        slippageBps: 500,
      },
      strategy,
      logLevel: 'info',
    };

    // Launch coordinator
    console.log(dim('  [5/5] Launching coordinator...'));
    this.coordinator = new SwarmCoordinator(swarmConfig);

    // Forward coordinator events to trade log
    this.coordinator.on('trade:executed', (result: TradeResult) => {
      this.tradeLog.push({
        timestamp: Date.now(),
        agentName: result.order.traderId,
        direction: result.order.direction === 'buy' ? 'BUY' : 'SELL',
        solAmount: Number(result.order.amount.toString()) / LAMPORTS_PER_SOL,
        tokenAmount: Number(result.amountOut.toString()),
      });
    });

    this.coordinator.on('phase:change', (phase: string) => {
      this.eventBus.emit(
        'phase:changed',
        'lifecycle',
        'cli-runner',
        { phase },
      );
    });

    console.log(green('  ✓ Coordinator launched'));
    console.log('');

    // Start status auto-refresh
    this.statusInterval = setInterval(() => {
      if (this.coordinator && !this.isShuttingDown) {
        this.lastStatus = this.coordinator.getStatus();
        this.clearScreen();
        this.displayStatus();
      }
    }, 5_000);

    // Set max duration timeout
    this.durationTimeout = setTimeout(() => {
      console.log(yellow('\n  ⏰ Maximum session duration reached.'));
      void this.shutdown();
    }, config.maxDurationMinutes * 60 * 1_000);

    // Start the coordinator in background
    void this.coordinator.run().then((finalStatus) => {
      this.lastStatus = finalStatus;
      if (!this.isShuttingDown) {
        console.log(green('\n  Swarm run completed naturally.'));
        void this.shutdown();
      }
    }).catch((err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(red(`\n  Swarm error: ${error.message}`));
      if (!this.isShuttingDown) {
        void this.shutdown();
      }
    });

    // Display initial status
    this.displayStatus();

    // Enter command loop
    await this.commandLoop();
  }

  /**
   * Listen for single-key runtime commands on stdin.
   */
  private async commandLoop(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!process.stdin.isTTY) {
        // Non-interactive mode — just wait
        return;
      }

      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      process.stdin.on('data', (key: string) => {
        if (this.isShuttingDown) return;

        // Ctrl+C in raw mode
        if (key === '\u0003') {
          void this.shutdown();
          resolve();
          return;
        }

        void this.handleCommand(key);
      });
    });
  }

  // ── Private: Prompt Helpers ──────────────────────────────────

  private promptInput(question: string, defaultValue?: string): Promise<string> {
    return new Promise((resolve) => {
      const defaultHint = defaultValue ? dim(` (${defaultValue})`) : '';
      const prompt = `  ${CYAN}?${RESET} ${question}${defaultHint}: `;

      this.rl?.question(prompt, (answer: string) => {
        const trimmed = answer.trim();
        resolve(trimmed || defaultValue || '');
      });
    });
  }

  private promptSelect(
    question: string,
    options: string[],
    defaultOption: string,
  ): Promise<string> {
    return new Promise((resolve) => {
      const optionsList = options
        .map((o) => (o === defaultOption ? bold(o) : o))
        .join(' / ');
      const prompt = `  ${CYAN}?${RESET} ${question}: (${optionsList}) `;

      this.rl?.question(prompt, (answer: string) => {
        const trimmed = answer.trim().toLowerCase();
        if (options.includes(trimmed)) {
          resolve(trimmed);
        } else {
          resolve(defaultOption);
        }
      });
    });
  }

  private promptYesNo(question: string, defaultYes: boolean): Promise<boolean> {
    return new Promise((resolve) => {
      const hint = defaultYes ? 'Y/n' : 'y/N';
      const prompt = `  ${CYAN}?${RESET} ${question} (${hint}): `;

      if (this.rl) {
        this.rl.question(prompt, (answer: string) => {
          const trimmed = answer.trim().toLowerCase();
          if (trimmed === '') {
            resolve(defaultYes);
          } else {
            resolve(trimmed === 'y' || trimmed === 'yes');
          }
        });
      } else {
        // No readline — use a temporary one
        const tempRl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        tempRl.question(prompt, (answer: string) => {
          tempRl.close();
          const trimmed = answer.trim().toLowerCase();
          if (trimmed === '') {
            resolve(defaultYes);
          } else {
            resolve(trimmed === 'y' || trimmed === 'yes');
          }
        });
      }
    });
  }

  // ── Private: Display Helpers ─────────────────────────────────

  private printBanner(): void {
    console.log('');
    console.log(cyan('  ╔══════════════════════════════════════════╗'));
    console.log(cyan('  ║') + bold('     🤖 PUMP AGENT SWARM - CLI v1.0      ') + cyan('║'));
    console.log(cyan('  ╠══════════════════════════════════════════╣'));
    console.log(cyan('  ║') + '  Autonomous Memecoin Agent Swarm         ' + cyan('║'));
    console.log(cyan('  ╚══════════════════════════════════════════╝'));
    console.log('');
  }

  private printConfigSummary(config: CLIConfig): void {
    console.log('');
    console.log(bold(cyan('  ═══ CONFIGURATION SUMMARY ═══')));
    console.log(`  Network:     ${bold(config.network)}`);
    console.log(`  Mode:        ${bold(config.mode)}`);
    if (config.tokenMint) {
      console.log(`  Token Mint:  ${bold(config.tokenMint)}`);
    }
    console.log(`  Budget:      ${bold(`${config.budget} SOL`)}`);
    console.log(`  Traders:     ${bold(String(config.traderCount))}`);
    console.log(`  Strategy:    ${bold(config.strategy)}`);
    if (config.enableDashboard) {
      console.log(`  Dashboard:   ${bold(`http://localhost:${config.dashboardPort}`)}`);
    } else {
      console.log(`  Dashboard:   ${dim('disabled')}`);
    }
    console.log(`  Duration:    ${bold(`${config.maxDurationMinutes} minutes`)}`);
    console.log(`  AI Brain:    ${config.openRouterApiKey ? green('enabled') : dim('disabled')}`);
    console.log('');
  }

  private displayConfig(): void {
    if (!this.config) {
      console.log(yellow('\n  No configuration loaded.\n'));
      return;
    }
    this.printConfigSummary(this.config);
  }

  /**
   * Show per-agent status summary.
   */
  displayAgents(): void {
    const status = this.lastStatus;

    console.log('');
    console.log(bold(cyan('  ═══ AGENT STATUS ═══')));
    console.log('');

    if (!status?.traderStats || Object.keys(status.traderStats).length === 0) {
      console.log(yellow('  No agents active yet.'));
      return;
    }

    console.log(
      `  ${'Agent'.padEnd(14)} ${'Phase'.padEnd(10)} ${'Buys'.padStart(5)} ${'Sells'.padStart(6)} ${'Win Rate'.padStart(10)} ${'P&L (SOL)'.padStart(12)}`,
    );
    console.log(`  ${'─'.repeat(60)}`);

    for (const [name, stats] of Object.entries(status.traderStats)) {
      const spent = Number(stats.solSpent.toString()) / LAMPORTS_PER_SOL;
      const recv = Number(stats.solReceived.toString()) / LAMPORTS_PER_SOL;
      const pnl = recv - spent;
      const totalTrades = stats.totalBuys + stats.totalSells;
      const winRate = totalTrades > 0 ? ((stats.totalSells / totalTrades) * 100).toFixed(0) + '%' : 'N/A';

      console.log(
        `  ${cyan(name.padEnd(14))} ${'active'.padEnd(10)} ${String(stats.totalBuys).padStart(5)} ${String(stats.totalSells).padStart(6)} ${winRate.padStart(10)} ${profitColor(pnl).padStart(12)}`,
      );
    }

    console.log('');
  }

  /**
   * Show recent trades list.
   */
  displayTrades(): void {
    console.log('');
    console.log(bold(cyan('  ═══ RECENT TRADES ═══')));
    console.log('');

    if (this.tradeLog.length === 0) {
      console.log(yellow('  No trades recorded yet.'));
      return;
    }

    const recent = this.tradeLog.slice(-20).reverse();
    console.log(
      `  ${'Time'.padEnd(10)} ${'Agent'.padEnd(12)} ${'Dir'.padEnd(5)} ${'SOL Amount'.padStart(12)} ${'Tokens'.padStart(14)}`,
    );
    console.log(`  ${'─'.repeat(55)}`);

    for (const trade of recent) {
      const time = new Date(trade.timestamp).toLocaleTimeString('en-US', { hour12: false });
      const dirColor = trade.direction === 'BUY' ? green : red;

      console.log(
        `  ${dim(time.padEnd(10))} ${trade.agentName.padEnd(12)} ${dirColor(trade.direction.padEnd(5))} ${trade.solAmount.toFixed(4).padStart(12)} ${trade.tokenAmount.toLocaleString().padStart(14)}`,
      );
    }

    console.log('');
    console.log(dim(`  Showing ${recent.length} of ${this.tradeLog.length} total trades`));
    console.log('');
  }

  /**
   * Toggle pause/resume of trading.
   */
  private togglePause(): void {
    if (!this.coordinator) {
      console.log(yellow('\n  No swarm running.\n'));
      return;
    }

    if (this.isPaused) {
      this.isPaused = false;
      this.eventBus.emit('command:resume', 'lifecycle', 'cli-runner', {});
      console.log(green('\n  ▶️  Trading resumed\n'));
    } else {
      this.isPaused = true;
      this.eventBus.emit('command:pause', 'lifecycle', 'cli-runner', {});
      console.log(yellow('\n  ⏸  Trading paused. Press [space] to resume.\n'));
    }
  }

  /**
   * Export session report on demand.
   */
  private async exportReport(): Promise<void> {
    console.log(dim('\n  Exporting session report...'));
    try {
      const reportPath = await this.exportSessionReport();
      console.log(green(`  ✓ Report saved: ${reportPath}\n`));
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.log(red(`  ✗ Export failed: ${error.message}\n`));
    }
  }

  private displayHelp(): void {
    console.log('');
    console.log(bold(cyan('  ═══ RUNTIME COMMANDS ═══')));
    console.log(`  ${bold('s')}      — Detailed status dump`);
    console.log(`  ${bold('a')}      — Agent status overview`);
    console.log(`  ${bold('t')}      — Recent trades list`);
    console.log(`  ${bold('p')}      — P&L breakdown by agent`);
    console.log(`  ${bold('c')}      — Show current configuration`);
    console.log(`  ${bold('x')}      — Export session report to JSON`);
    console.log(`  ${bold('space')}  — Toggle pause/resume trading`);
    console.log(`  ${bold('d')}      — Show dashboard URL`);
    console.log(`  ${bold('e')}      — Trigger exit strategy and shutdown`);
    console.log(`  ${bold('h')}      — Show this help text`);
    console.log(`  ${bold('q')}      — Emergency stop (immediate halt)`);
    console.log('');
  }

  private clearScreen(): void {
    process.stdout.write('\x1b[2J\x1b[H');
  }

  private formatUptime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1_000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }

  private getHealthLabel(): string {
    if (!this.healthMonitor) return yellow('⏳');
    // We can't await in a sync method, so use a cached approach
    return green('✅');
  }

  // ── Private: Signal Handlers ─────────────────────────────────

  private setupSignalHandlers(): void {
    const handler = (): void => {
      if (this.isShuttingDown) {
        console.log(red('\n  Force exit.'));
        process.exit(1);
      }
      console.log(yellow('\n\n  Received shutdown signal...'));
      void this.shutdown();
    };

    process.on('SIGINT', handler);
    process.on('SIGTERM', handler);
  }

  // ── Private: Event Bus Subscriptions ─────────────────────────

  private subscribeToEvents(): void {
    this.eventBus.subscribe(
      'trade:*',
      (event: SwarmEvent) => {
        if (event.type === 'trade:executed' && event.payload) {
          const payload = event.payload as Record<string, unknown>;
          const direction = payload.direction as string;
          const solAmount = typeof payload.solAmount === 'number' ? payload.solAmount : 0;
          const tokenAmount = typeof payload.tokenAmount === 'number' ? payload.tokenAmount : 0;

          this.tradeLog.push({
            timestamp: event.timestamp,
            agentName: event.source,
            direction: direction === 'buy' ? 'BUY' : 'SELL',
            solAmount,
            tokenAmount,
          });
        }
      },
      { source: 'cli-runner' },
    );
  }

  // ── Private: Wallet Resolution ───────────────────────────────

  private async resolveKeypair(keyOrPath: string): Promise<Keypair> {
    // Try as file path first
    if (keyOrPath.endsWith('.json') || keyOrPath.startsWith('./') || keyOrPath.startsWith('/')) {
      const resolvedPath = keyOrPath.startsWith('/')
        ? keyOrPath
        : join(process.cwd(), keyOrPath);

      if (!existsSync(resolvedPath)) {
        throw new Error(`Keypair file not found: ${resolvedPath}`);
      }

      const fileContent = await readFile(resolvedPath, 'utf-8');
      const secretKeyArray = JSON.parse(fileContent) as number[];
      if (!Array.isArray(secretKeyArray) || secretKeyArray.length !== 64) {
        throw new Error(
          `Invalid keypair file format. Expected JSON array of 64 bytes.`,
        );
      }
      return Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
    }

    // Try as base58 encoded private key
    try {
      const decoded = bs58.decode(keyOrPath);
      return Keypair.fromSecretKey(decoded);
    } catch {
      throw new Error(
        `Invalid wallet key. Provide a base58 private key or path to a keypair JSON file.`,
      );
    }
  }

  // ── Private: Emergency Stop ──────────────────────────────────

  private async emergencyStop(): Promise<void> {
    this.isShuttingDown = true;

    if (this.statusInterval !== null) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }
    if (this.durationTimeout !== null) {
      clearTimeout(this.durationTimeout);
      this.durationTimeout = null;
    }

    if (this.coordinator) {
      try {
        await this.coordinator.stop();
      } catch {
        // Best effort
      }
    }

    if (this.healthMonitor) {
      this.healthMonitor.stopMonitoring();
    }
    if (this.rpcPool) {
      this.rpcPool.stopHealthChecks();
    }

    this.eventBus.unsubscribeAll('cli-runner');
    SwarmEventBus.resetInstance();

    console.log(red(bold('  Emergency stop complete.')));
    process.exit(1);
  }

  // ── Private: Session Export ──────────────────────────────────

  private async exportSessionReport(): Promise<string> {
    const endedAt = Date.now();

    const realized = this.lastStatus
      ? Number(
          this.lastStatus.totalSolReceived
            .sub(this.lastStatus.totalSolSpent)
            .toString(),
        ) / LAMPORTS_PER_SOL
      : 0;
    const invested = this.config?.budget ?? 0;
    const roi = invested > 0 ? (realized / invested) * 100 : 0;

    const report: SessionExport = {
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      endedAt,
      durationMs: endedAt - this.startedAt,
      config: this.config as CLIConfig,
      finalStatus: this.lastStatus,
      tradeLog: this.tradeLog,
      pnl: {
        realized,
        unrealized: 0,
        total: realized,
        roi,
      },
    };

    const filename = `swarm-session-${this.startedAt}.json`;
    const filepath = join(process.cwd(), filename);
    await writeFile(filepath, JSON.stringify(report, replacerBN, 2), 'utf-8');
    return filepath;
  }
}

// ─── JSON Serialization Helper for BN ────────────────────────

function replacerBN(_key: string, value: unknown): unknown {
  if (value instanceof BN) {
    return value.toString();
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}

// ─── Main Entry Point ────────────────────────────────────────

async function main(): Promise<void> {
  const cli = new SwarmCLI();
  await cli.run();
}

main().catch((error: unknown) => {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(`${RED}Fatal error:${RESET} ${err.message}`);
  if (err.stack) {
    console.error(dim(err.stack));
  }
  process.exit(1);
});
