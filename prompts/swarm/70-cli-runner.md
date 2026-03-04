# Prompt 70 — CLI Runner

## Agent Identity & Rules

```
You are the CLI-RUNNER builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real interactive CLI, real swarm launch, real Solana transactions
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add interactive CLI runner for launching the full agent swarm"
```

## Objective

Create `packages/pump-agent-swarm/src/demo/cli-runner.ts` — an interactive CLI command that launches the full autonomous agent swarm. It guides the user through configuration (network, strategy, budget, agent count), displays real-time colored terminal output of agent actions, handles graceful shutdown on SIGINT/SIGTERM, and shows a compact live dashboard of P&L, trade count, phase, and agent status.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/demo/cli-runner.ts`

## Dependencies

- `../coordination/swarm-orchestrator` — `SwarmOrchestrator`, `SwarmOrchestratorConfig` (P50)
- `../coordination/health-monitor` — `HealthMonitor` (P55)
- `../coordination/phase-controller` — `PhaseController` (P56)
- `../coordination/audit-logger` — `AuditLogger` (P58)
- `../infra/event-bus` — `SwarmEventBus` (P04)
- `../infra/logger` — `SwarmLogger` (P07)
- `../infra/metrics` — `MetricsCollector` (P08)
- `../trading/pnl-tracker` — `PnLTracker` (P29)
- `../dashboard/export-manager` — `ExportManager` (P69)
- `@solana/web3.js` — `Connection`, `Keypair`, `LAMPORTS_PER_SOL`
- `node:readline` — interactive prompts
- `node:process` — signal handling

## Deliverables

### Create `packages/pump-agent-swarm/src/demo/cli-runner.ts`

1. **`SwarmCLI` class**:
   - `constructor()`
   - `run(): Promise<void>` — main entry point; runs the interactive setup, launches swarm, handles lifecycle
   - `promptConfig(): Promise<CLIConfig>` — interactive readline prompts for user configuration
   - `validateConfig(config: CLIConfig): ValidationResult` — validate user inputs before proceeding
   - `confirmLaunch(config: CLIConfig): Promise<boolean>` — show summary and ask for confirmation
   - `launchSwarm(config: CLIConfig): Promise<void>` — create orchestrator, initialize, start
   - `setupSignalHandlers(orchestrator: SwarmOrchestrator): void` — SIGINT/SIGTERM graceful shutdown
   - `startLiveDisplay(orchestrator: SwarmOrchestrator): NodeJS.Timeout` — periodic compact status output
   - `showFinalReport(orchestrator: SwarmOrchestrator): void` — summary after shutdown
   - `shutdown(orchestrator: SwarmOrchestrator, reason: string): Promise<void>` — graceful shutdown sequence

2. **`CLIConfig` interface**:
   ```typescript
   interface CLIConfig {
     /** Solana network to connect to */
     network: 'mainnet-beta' | 'devnet';
     /** RPC URL (default based on network) */
     rpcUrl: string;
     /** Master wallet private key (base58) or path to keypair JSON */
     walletSecret: string;
     /** Strategy: create new token, buy existing, or let AI decide */
     strategy: 'create-new' | 'buy-existing' | 'auto';
     /** Total SOL budget for the session */
     budgetSOL: number;
     /** Number of trader agents to spawn */
     traderCount: number;
     /** OpenRouter API key for AI decisions */
     openRouterApiKey: string;
     /** Max session duration in minutes (0 = unlimited) */
     maxDurationMinutes: number;
     /** Enable live dashboard HTTP server */
     enableDashboard: boolean;
     /** Dashboard port (if enabled) */
     dashboardPort: number;
     /** Log level */
     logLevel: 'debug' | 'info' | 'warn' | 'error';
     /** If buy-existing: target token mint address */
     targetMint?: string;
   }
   ```

3. **`ValidationResult` interface**:
   ```typescript
   interface ValidationResult {
     valid: boolean;
     errors: string[];
     warnings: string[];
   }
   ```

4. **Interactive prompts** (`promptConfig()`):
   ```typescript
   // Uses node:readline/promises for async prompts
   // Each prompt includes a default value in brackets, e.g., "Network [devnet]: "
   //
   // 1. "🌐 Network (mainnet-beta / devnet) [devnet]: "
   //    - Validate: must be 'mainnet-beta' or 'devnet'
   //    - Default: 'devnet'
   //
   // 2. "🔗 RPC URL [default for selected network]: "
   //    - Default: 'https://api.devnet.solana.com' or 'https://api.mainnet-beta.solana.com'
   //
   // 3. "🔑 Wallet private key (base58) or keypair path: "
   //    - Required, no default
   //    - If path, read and parse JSON keypair file
   //    - Show derived public key for confirmation
   //
   // 4. "🎯 Strategy (create-new / buy-existing / auto) [auto]: "
   //    - Default: 'auto'
   //    - If 'buy-existing', prompt for target mint address
   //
   // 5. "💰 Budget in SOL [1.0]: "
   //    - Validate: positive number, >= 0.1
   //    - Default: 1.0 for devnet, prompt carefully for mainnet
   //    - If mainnet and budget > 10 SOL, show warning
   //
   // 6. "🤖 Number of trader agents [3]: "
   //    - Validate: 1-20
   //    - Default: 3
   //
   // 7. "🧠 OpenRouter API key [from env OPENROUTER_API_KEY]: "
   //    - Default: process.env.OPENROUTER_API_KEY
   //    - If empty, warn that AI decisions will fall back to rule-based
   //
   // 8. "⏱️  Max session duration in minutes (0 = unlimited) [30]: "
   //    - Default: 30
   //
   // 9. "📊 Enable live dashboard? (y/n) [y]: "
   //    - Default: yes
   //    - If yes, prompt for port [3000]
   //
   // 10. "📝 Log level (debug / info / warn / error) [info]: "
   //     - Default: 'info'
   ```

5. **Launch confirmation** (`confirmLaunch()`):
   ```typescript
   // Display a summary box before launch:
   //
   // ╔══════════════════════════════════════════╗
   // ║        SWARM LAUNCH CONFIGURATION        ║
   // ╠══════════════════════════════════════════╣
   // ║  Network:     devnet                     ║
   // ║  RPC:         https://api.devnet...      ║
   // ║  Wallet:      7xKX...3nPq               ║
   // ║  Balance:     5.00 SOL                   ║
   // ║  Budget:      1.00 SOL                   ║
   // ║  Strategy:    auto (AI decides)          ║
   // ║  Traders:     3 agents                   ║
   // ║  Duration:    30 minutes                 ║
   // ║  Dashboard:   http://localhost:3000      ║
   // ╠══════════════════════════════════════════╣
   // ║  ⚠️  MAINNET WARNING (if applicable)     ║
   // ║  Real SOL will be spent!                 ║
   // ╚══════════════════════════════════════════╝
   //
   // "🚀 Launch swarm? (yes/no): "
   // Must type 'yes' (not just 'y') for mainnet
   ```

6. **Live display** (`startLiveDisplay()`):
   ```typescript
   // Prints compact status every 5 seconds to terminal:
   //
   // ─── SWARM STATUS [00:05:23] ──────────────────────────────────
   //  Phase: TRADING  │  Agents: 7/7 healthy  │  Uptime: 5m 23s
   //  P&L: +0.142 SOL (+14.2%)  │  Trades: 47  │  Win Rate: 63%
   //  Budget: 0.858/1.000 SOL   │  Token: $MOONCAT (3xK...mint)
   //  Last: TraderAgent-02 BUY 0.01 SOL @ 0.0000234 (3s ago)
   // ──────────────────────────────────────────────────────────────
   //
   // Use ANSI escape codes for colors:
   //  - Green for positive P&L, red for negative
   //  - Yellow for warnings (low budget, degraded health)
   //  - Cyan for agent names
   //  - Bold for headers
   //  - Use \r and cursor movement to overwrite previous status (no scrolling)
   //
   // Subscribes to event bus for real-time updates:
   //  - 'trade:executed' → update last trade line
   //  - 'phase:changed' → update phase
   //  - 'pnl:updated' → update P&L
   //  - 'health:degraded' → show warning
   //  - 'health:critical' → show alert
   ```

7. **Signal handling** (`setupSignalHandlers()`):
   ```typescript
   // Handle SIGINT (Ctrl+C) and SIGTERM:
   //
   // First signal:
   //   - Print "\n⚠️  Shutdown signal received. Gracefully stopping..."
   //   - Call orchestrator.stop('user-interrupt')
   //   - Start 30-second shutdown timer
   //   - During shutdown, show progress: "Closing positions... Reclaiming funds... Generating report..."
   //
   // Second signal (impatient user):
   //   - Print "\n⛔ Force shutdown. Some positions may remain open."
   //   - Call orchestrator.destroy()
   //   - process.exit(1)
   //
   // On clean shutdown:
   //   - Show final P&L report
   //   - Export session data if ExportManager available
   //   - Print "✅ Swarm shutdown complete."
   //   - process.exit(0)
   ```

8. **Final report** (`showFinalReport()`):
   ```typescript
   // Print a comprehensive session summary:
   //
   // ╔══════════════════════════════════════════╗
   // ║          SESSION COMPLETE                 ║
   // ╠══════════════════════════════════════════╣
   // ║  Duration:     00:32:15                  ║
   // ║  Total Trades: 234                       ║
   // ║  Volume:       4.56 SOL                  ║
   // ║  Final P&L:    +0.42 SOL (+42.0%)        ║
   // ║  Max Drawdown: -8.3%                     ║
   // ║  Win Rate:     64.1%                     ║
   // ║  Best Trade:   +0.08 SOL                 ║
   // ║  Worst Trade:  -0.03 SOL                 ║
   // ╠══════════════════════════════════════════╣
   // ║  Agent Performance:                      ║
   // ║  MarketMaker:  +0.18 SOL (87 trades)     ║
   // ║  VolumeBot:    +0.12 SOL (64 trades)     ║
   // ║  Accumulator:  +0.15 SOL (42 trades)     ║
   // ║  Sniper:       -0.03 SOL (41 trades)     ║
   // ╚══════════════════════════════════════════╝
   //
   // Optionally export full report to file:
   //  "📁 Session report saved to: ./reports/session-{id}.md"
   ```

9. **`main()` function** — standalone entry point:
   ```typescript
   // At the bottom of the file:
   async function main(): Promise<void> {
     console.log('');
     console.log('  ╔═══════════════════════════════════╗');
     console.log('  ║    🐝 CRYPTO VISION AGENT SWARM   ║');
     console.log('  ║    Autonomous Trading System       ║');
     console.log('  ╚═══════════════════════════════════╝');
     console.log('');

     const cli = new SwarmCLI();
     await cli.run();
   }

   // Auto-run when executed directly
   main().catch((error) => {
     console.error('Fatal error:', error);
     process.exit(1);
   });
   ```

10. **Color utilities** — ANSI color helpers:
    ```typescript
    const colors = {
      reset: '\x1b[0m',
      bold: '\x1b[1m',
      dim: '\x1b[2m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m',
      bgRed: '\x1b[41m',
      bgGreen: '\x1b[42m',
    } as const;

    function colorize(text: string, color: keyof typeof colors): string {
      return `${colors[color]}${text}${colors.reset}`;
    }

    function pnlColor(value: number): string {
      return value >= 0 ? colorize(`+${value.toFixed(4)}`, 'green') : colorize(value.toFixed(4), 'red');
    }
    ```

### Success Criteria

- Interactive prompts work with readline, accepting defaults on Enter
- Config validation catches invalid inputs (negative budget, invalid network, etc.)
- Mainnet usage shows clear warnings and requires explicit confirmation
- Orchestrator initializes and starts correctly from CLI config
- Live display updates every 5 seconds with real swarm data
- SIGINT triggers graceful shutdown; second SIGINT force-kills
- Final report shows accurate session statistics
- Entry point runs standalone: `npx tsx packages/pump-agent-swarm/src/demo/cli-runner.ts`
- Compiles with `npx tsc --noEmit`
