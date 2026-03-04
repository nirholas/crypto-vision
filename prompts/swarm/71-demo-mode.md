# Prompt 71 — Demo Mode

## Agent Identity & Rules

```
You are the DEMO-MODE builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real devnet transactions, real agent coordination, real AI decisions
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add hackathon demo mode with guided devnet walkthrough"
```

## Objective

Create `packages/pump-agent-swarm/src/demo/demo-mode.ts` — a guided demo mode designed for hackathon presentations. Uses Solana devnet for safety, walks through each phase of the swarm lifecycle with narration, and produces a summary report. Audience can watch agents autonomously coordinate in real-time.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/demo/demo-mode.ts`

## Dependencies

- `@solana/web3.js` — Connection, LAMPORTS_PER_SOL (for devnet airdrop)
- `../coordination/swarm-orchestrator` — SwarmOrchestrator (P50)
- `../intelligence/strategy-brain` — StrategyBrain (P40)
- `../intelligence/narrative-generator` — NarrativeGenerator (P48)
- `../infra/wallet-vault` — WalletVault (P03)
- `../infra/rpc-pool` — RPCConnectionPool (P02)
- `../infra/event-bus` — SwarmEventBus (P04)
- `../infra/logging` — SwarmLogger (P07)
- `../bundle/launch-sequencer` — LaunchSequencer (P36)
- `../trading/wash-engine` — WashEngine (P20)
- `../dashboard/server` — DashboardServer (P60)
- `../dashboard/export-manager` — ExportManager (P69)

## Deliverables

### Create `packages/pump-agent-swarm/src/demo/demo-mode.ts`

1. **`DemoMode` class**:
   - `constructor(config?: DemoConfig)`
   - `runDemo(): Promise<DemoResult>` — execute the full guided demo
   - `runStep(step: DemoStep): Promise<StepResult>` — execute a single step
   - `pause(): void` — pause the demo
   - `resume(): void` — resume the demo
   - `skip(): void` — skip current step
   - `abort(): Promise<void>` — abort and cleanup

2. **`DemoConfig` interface**:
   ```typescript
   interface DemoConfig {
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
     /** Enable dashboard alongside demo (default: true) */
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
   ```

3. **Demo steps** (9-step walkthrough):
   ```typescript
   type DemoStep =
     | 'generate-wallets'
     | 'fund-wallets'
     | 'ai-strategy'
     | 'generate-narrative'
     | 'create-token'
     | 'bundle-buy'
     | 'start-trading'
     | 'show-results'
     | 'cleanup';
   ```

4. **Step details**:

   **Step 1 — Generate Wallets**:
   ```
   ┌─────────────────────────────────────────────┐
   │  STEP 1/9: Generating Agent Wallet Pool     │
   ├─────────────────────────────────────────────┤
   │ Creating 5 Solana wallets for the swarm...  │
   │                                             │
   │ ✅ Creator:    7xKz...4mNp                  │
   │ ✅ Trader-1:   3bFq...8vRs                  │
   │ ✅ Trader-2:   9dJw...2cTk                  │
   │ ✅ Trader-3:   5gLm...6xHn                  │
   │ ✅ Sentinel:   1aRv...7pQs                  │
   │                                             │
   │ 5 wallets generated in 0.3s                 │
   └─────────────────────────────────────────────┘
   ```

   **Step 2 — Fund Wallets** (devnet airdrop):
   - Call `connection.requestAirdrop(wallet, 2 * LAMPORTS_PER_SOL)` for each wallet
   - Retry up to 3 times on failure (devnet airdrop can be flaky)
   - Confirm each airdrop transaction
   - Show balance after funding

   **Step 3 — AI Strategy Decision**:
   - Call StrategyBrain to decide: create new token vs buy existing
   - Display the AI's reasoning in the console
   - Show confidence score and key factors

   **Step 4 — Generate Narrative**:
   - Call NarrativeGenerator to create token concept
   - Display: name, ticker, description, narrative
   - Show why this narrative was chosen (trend alignment)

   **Step 5 — Create Token**:
   - Create token on Pump.fun via creator agent (devnet)
   - Display transaction signature and token mint address
   - Show bonding curve initial state
   - Note: on devnet, Pump.fun may not be available — if so, create a standard SPL token as fallback and simulate bonding curve

   **Step 6 — Bundle Buy**:
   - Execute multi-wallet bundle buy
   - Show each wallet's purchase amount and token receipt
   - Display final supply distribution

   **Step 7 — Start Trading**:
   - Launch trader agents in coordinated trading
   - Show live trade feed for 30-60 seconds
   - Display agent-to-agent trades as they happen

   **Step 8 — Show Results**:
   - Display final P&L summary
   - Show supply distribution
   - Show trade statistics
   - Display agent performance leaderboard

   **Step 9 — Cleanup**:
   - Stop all agents
   - Reclaim SOL to master wallet
   - Export session report
   - Display final summary

5. **`StepResult` interface**:
   ```typescript
   interface StepResult {
     step: DemoStep;
     success: boolean;
     duration: number;
     output: string[];
     data: Record<string, unknown>;
     error?: string;
   }
   ```

6. **`DemoResult` interface**:
   ```typescript
   interface DemoResult {
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
   ```

7. **Console formatting**:
   - Box-drawing characters for step boundaries
   - Green checkmarks ✅ for completed sub-tasks
   - Red ❌ for failures
   - Spinning animation for in-progress operations (use `['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏']`)
   - Step counter: "STEP X/9"
   - Elapsed time per step
   - Progress bar for multi-item operations (funding, trading)

8. **Safety features**:
   - Devnet only — reject mainnet config
   - Budget cap: max 10 SOL per wallet (devnet limits)
   - Auto-stop after `maxDurationMinutes`
   - Graceful cleanup on abort/error

### Success Criteria

- Demo runs end-to-end on devnet without manual intervention
- Each step has clear visual output suitable for a live presentation
- Devnet airdrop succeeds with retry logic
- AI strategy and narrative decisions display in console
- Trading phase shows real-time agent activity
- Results summary shows meaningful P&L and statistics
- Session report exported on completion
- Falls back gracefully if devnet Pump.fun unavailable
- Compiles with `npx tsc --noEmit`
