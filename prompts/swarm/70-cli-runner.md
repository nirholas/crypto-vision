# Prompt 70 — CLI Runner

## Agent Identity & Rules

```
You are the CLI-RUNNER builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real interactive CLI, real swarm launch, real Solana transactions
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add interactive CLI runner for launching and controlling the agent swarm"
```

## Objective

Create `packages/pump-agent-swarm/src/demo/cli-runner.ts` — an interactive CLI application for launching, monitoring, and controlling the full agent swarm from the terminal. This is the primary entry point for running the swarm.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/demo/cli-runner.ts`

## Dependencies

- `readline` — Node.js built-in for interactive prompts
- `../coordination/swarm-orchestrator` — SwarmOrchestrator (P50)
- `../coordination/swarm-config-manager` — SwarmConfigManager (P59)
- `../coordination/health-monitor` — HealthMonitor (P55)
- `../intelligence/strategy-brain` — StrategyBrain (P40)
- `../infra/wallet-vault` — WalletVault (P03)
- `../infra/rpc-pool` — RPCConnectionPool (P02)
- `../infra/event-bus` — SwarmEventBus (P04)
- `../infra/logging` — SwarmLogger (P07)
- `../dashboard/server` — DashboardServer (P60)
- `../strategies` — preset strategies
- `../types` — all types

## Deliverables

### Create `packages/pump-agent-swarm/src/demo/cli-runner.ts`

1. **`SwarmCLI` class**:
   - `constructor()`
   - `run(): Promise<void>` — main entry point, interactive wizard then launch
   - `promptConfig(): Promise<CLIConfig>` — collect configuration from user interactively
   - `displayStatus(): void` — show current swarm status in compact format
   - `displayPnL(): void` — show P&L summary
   - `handleCommand(command: string): Promise<void>` — handle runtime commands
   - `shutdown(): Promise<void>` — graceful shutdown sequence

2. **`CLIConfig` interface**:
   ```typescript
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
   ```

3. **Interactive wizard flow**:
   ```
   ╔══════════════════════════════════════════╗
   ║     🤖 PUMP AGENT SWARM - CLI v1.0      ║
   ╠══════════════════════════════════════════╣
   ║ Autonomous Memecoin Agent Swarm          ║
   ╚══════════════════════════════════════════╝

   ? Select network: (mainnet-beta / devnet)
   ? Select mode: (create-new / buy-existing / auto)
   ? SOL budget: (e.g., 5.0)
   ? Number of trader agents: (e.g., 5)
   ? Trading strategy: (organic / volume / graduation / exit)
   ? Master wallet key or path: (base58 or ./keypair.json)
   ? Enable live dashboard? (Y/n)
   ? Max session duration (minutes): (e.g., 60)

   ═══ CONFIGURATION SUMMARY ═══
   Network:     devnet
   Mode:        create-new
   Budget:      5.0 SOL
   Traders:     5
   Strategy:    organic
   Dashboard:   http://localhost:3847
   Duration:    60 minutes

   ? Confirm and launch? (Y/n)
   ```

4. **Runtime display** (updates every 5 seconds):
   ```
   ┌─ SWARM STATUS ──────────────────────────────────┐
   │ Phase: TRADING  │ Uptime: 12m 34s  │ Health: ✅  │
   ├─ P&L ───────────────────────────────────────────┤
   │ Realized: +0.234 SOL  │ Unrealized: +0.089 SOL  │
   │ Total: +0.323 SOL     │ ROI: +6.46%             │
   ├─ AGENTS ────────────────────────────────────────┤
   │ Trader-1  ✅ 12 trades  +0.05 SOL               │
   │ Trader-2  ✅  8 trades  +0.12 SOL               │
   │ Trader-3  ✅ 15 trades  -0.02 SOL               │
   │ MarketMkr ✅  6 trades  +0.08 SOL               │
   │ Sentinel  ✅ watching                            │
   ├─ LAST 3 TRADES ─────────────────────────────────┤
   │ 14:23:01 Trader-2 BUY  0.5 SOL → 12,340 tokens │
   │ 14:22:45 Trader-1 SELL 8,200 tokens → 0.35 SOL  │
   │ 14:22:12 MarketMkr BUY 0.2 SOL → 4,670 tokens  │
   └─────────────────────────────────────────────────┘
   Commands: [s]tatus [p]nl [c]onfig [e]xit [h]elp
   ```

5. **Runtime commands** (single keypress):
   - `s` — detailed status dump
   - `p` — P&L breakdown by agent
   - `c` — show/modify configuration
   - `e` — trigger exit strategy and shutdown
   - `h` — help text
   - `q` — emergency stop (immediate halt)
   - `d` — open dashboard in browser

6. **Signal handling**:
   - `SIGINT` (Ctrl+C) — trigger graceful shutdown: stop trading → reclaim funds → export report → exit
   - `SIGTERM` — same as SIGINT
   - On shutdown: export session report to `./swarm-session-{timestamp}.json`

7. **Color scheme** (using ANSI codes):
   - Green: profits, successful trades, healthy agents
   - Red: losses, failed trades, errors
   - Yellow: warnings, pending operations
   - Cyan: headers, agent names
   - White: standard text
   - Bold: section headers
   - Dim: timestamps, secondary info

8. **`main()` function**:
   ```typescript
   async function main(): Promise<void> {
     const cli = new SwarmCLI();
     await cli.run();
   }

   main().catch((error) => {
     console.error('Fatal error:', error);
     process.exit(1);
   });
   ```

### Success Criteria

- Interactive wizard collects all configuration via readline
- Environment variables used as defaults (SOLANA_RPC_URL, MASTER_WALLET_KEY, OPENROUTER_API_KEY)
- Swarm launches with configured agents and begins operation
- Real-time status display updates in terminal
- Runtime commands work during operation
- Graceful shutdown exports session data
- SIGINT/SIGTERM handled properly
- Runs via: `npx tsx packages/pump-agent-swarm/src/demo/cli-runner.ts`
- Compiles with `npx tsc --noEmit`
