# Prompt 71 — Demo Mode

## Agent Identity & Rules

```
You are the DEMO-MODE builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real devnet transactions, real agent coordination, real AI decisions, real faucet requests
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add hackathon demo mode with guided devnet walkthrough, step-by-step narration, and faucet funding"
```

## Objective

Create `packages/pump-agent-swarm/src/demo/demo-mode.ts` — a guided demo mode designed for hackathon presentations and onboarding. Uses Solana **devnet** for safety with SOL obtained from the faucet, walks through each phase of the swarm lifecycle with step-by-step narration, and produces a summary report. Audience can watch agents autonomously coordinate in real-time. Auto-stops after a configurable duration. Safe for live demos: limited budget, devnet only, deterministic phases, and automatic cleanup.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/demo/demo-mode.ts`

## Dependencies

- `@solana/web3.js` — `Connection`, `Keypair`, `LAMPORTS_PER_SOL`, `clusterApiUrl` (for devnet airdrop)
- `../agents/creator-agent` — `CreatorAgent` (P12)
- `../agents/narrative-agent` — `NarrativeAgent` (P10)
- `../bundle/launch-sequencer` — `LaunchSequencer` (P36)
- `../coordination/audit-logger` — `AuditLogger` (P58)
- `../coordination/phase-controller` — `PhaseController` (P56)
- `../coordination/swarm-orchestrator` — `SwarmOrchestrator`, `SwarmOrchestratorConfig` (P50)
- `../dashboard/export-manager` — `ExportManager` (P69)
- `../dashboard/server` — DashboardServer (P60)
- `../infra/event-bus` — `SwarmEventBus` (P04)
- `../infra/logger` — `SwarmLogger` (P07)
- `../infra/logging` — SwarmLogger (P07)
- `../infra/rpc-pool` — RPCConnectionPool (P02)
- `../infra/wallet-vault` — WalletVault (P03)
- `../intelligence/narrative-generator` — NarrativeGenerator (P48)
- `../intelligence/signal-generator` — `SignalGenerator` (P41)
- `../intelligence/strategy-brain` — `StrategyBrain` (P40)
- `../trading/pnl-tracker` — `PnLTracker` (P29)
- `../trading/wash-engine` — `WashEngine` (P20)

## Deliverables

### Create `packages/pump-agent-swarm/src/demo/demo-mode.ts`

1. **`DemoMode` class**:
   - `constructor(config?: Partial<DemoConfig>)`
   - `runDemo(config?: Partial<DemoConfig>): Promise<DemoResult>` — main entry: runs the full guided demo
   - `runStep(step: DemoStep): Promise<StepResult>` — execute a single demo step
   - `requestDevnetAirdrop(connection: Connection, publicKey: PublicKey, amount: number): Promise<string>` — request SOL from devnet faucet
   - `generateWalletPool(count: number): Keypair[]` — create ephemeral wallets for the demo
   - `fundWalletPool(connection: Connection, source: Keypair, wallets: Keypair[], amountPerWallet: number): Promise<string[]>` — distribute SOL to trader wallets
   - `waitWithCountdown(seconds: number, message: string): Promise<void>` — pause with visible countdown for dramatic effect
   - `printStepBanner(step: number, total: number, title: string, description: string): void` — formatted step header
   - `printSummary(result: DemoResult): void` — final summary output
   - `cleanup(connection: Connection, wallets: Keypair[], masterWallet: Keypair): Promise<void>` — reclaim SOL from demo wallets
   - `pause(): void` — pause the demo
   - `resume(): void` — resume the demo
   - `skip(): void` — skip current step
   - `abort(): Promise<void>` — abort and cleanup

2. **`DemoConfig` interface**:
   ```typescript
   interface DemoConfig {
     /** Always devnet — mainnet is not allowed in demo mode */
     network: 'devnet';
     /** Custom devnet RPC URL (default: 'https://api.devnet.solana.com') */
     rpcUrl: string;
     /** SOL to request from faucet (max 2 SOL per request, default: 2) */
     faucetAmount: number;
     /** SOL budget per wallet from airdrop (default: 2) */
     solPerWallet: number;
     /** Number of trader agents for the demo (default: 3) */
     traderCount: number;
     /** OpenRouter API key for AI decisions and narration */
     openRouterApiKey: string;
     /** Delay between steps in seconds for dramatic effect (default: 3) */
     stepDelay: number;
     /** Delay between steps in ms for dramatic effect (default: 3000) */
     stepDelayMs: number;
     /** Maximum demo duration in minutes (default: 10) */
     maxDurationMinutes: number;
     /** Enable verbose logging */
     verbose: boolean;
     /** Enable dashboard during demo (default: true) */
     enableDashboard: boolean;
     /** Dashboard port (default: 3847) */
     dashboardPort: number;
     /**
      * Steps to run. Defaults to all steps.
      * Can skip steps for shorter demos.
      */
     steps: DemoStepName[];
     /** Auto-pause after each step for audience Q&amp;A */
     pauseBetweenSteps: boolean;
     /** Auto-advance through steps vs wait for keypress */
     autoAdvance: boolean;
   }
   ```

3. **`DemoStep` and `DemoStepName` types** (9-step walkthrough):
   ```typescript
   type DemoStepName =
     | 'generate-wallets'
     | 'fund-wallets'
     | 'fund-from-faucet'
     | 'ai-strategy'
     | 'ai-strategy-decision'
     | 'generate-narrative'
     | 'create-token'
     | 'bundle-buy'
     | 'start-trading'
     | 'show-results'
     | 'show-pnl'
     | 'exit-positions'
     | 'cleanup';

   interface DemoStep {
     /** Step index (1-based) */
     index: number;
     /** Step identifier */
     name: DemoStepName;
     /** Human-readable title for display */
     title: string;
     /** Description of what this step does */
     description: string;
     /** Estimated duration in seconds */
     estimatedDuration: number;
     /** The function to execute for this step */
     execute: () => Promise<StepResult>;
   }
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
- All 9 steps execute in sequence with clear visual output
- Each step shows a formatted banner with step number and description
- Faucet requests handle rate limits and retries gracefully
     title: string;
     /** Description of what this step does */
     description: string;
     /** Estimated duration in seconds */
     estimatedDuration: number;
     /** The function to execute for this step */
     execute: () => Promise<StepResult>;
   }
   ```

4. **`StepResult` and `DemoResult` interfaces**:
   ```typescript
   interface StepResult {
     /** Step name */
     step: DemoStepName;
     /** Whether the step succeeded */
     success: boolean;
     /** Human-readable outcome message */
     message: string;
     /** Duration of this step in ms */
     durationMs: number;
     /** Any data produced by the step */
     data?: Record<string, unknown>;
     /** Error details if failed */
     error?: string;
   }

   interface DemoResult {
     /** Overall success */
     success: boolean;
     /** Session ID */
     sessionId: string;
     /** Total duration in ms */
     totalDurationMs: number;
     /** Per-step results */
     steps: StepResult[];
     /** Summary statistics */
     summary: {
       walletsGenerated: number;
       solFunded: number;
       tokenCreated: boolean;
       tokenMint: string | null;
       tokenName: string | null;
       totalTrades: number;
       finalPnlSOL: number;
       finalPnlPercent: number;
       solReclaimed: number;
     };
   }
   ```

5. **Default demo steps** — the guided walkthrough:
   ```typescript
   // Step 1: Generate Wallet Pool
   // ┌─────────────────────────────────────────────────────┐
   // │  STEP 1/9 — Generate Wallet Pool                    │
   // │  Creating ephemeral wallets for the swarm agents    │
   // └─────────────────────────────────────────────────────┘
   //
   // - Generate master wallet + N trader wallets (Keypair.generate())
   // - Display each wallet's public key with role label
   // - Print: "✅ Generated {N} wallets for the swarm"
   // - Duration: instant

   // Step 2: Fund from Faucet
   // ┌─────────────────────────────────────────────────────┐
   // │  STEP 2/9 — Fund from Devnet Faucet                 │
   // │  Requesting free SOL from the Solana devnet faucet  │
   // └─────────────────────────────────────────────────────┘
   //
   // - Request airdrop to master wallet (connection.requestAirdrop)
   // - Wait for confirmation (confirmTransaction)
   // - Show balance after funding
   // - Print: "✅ Funded master wallet with {amount} SOL"
   // - Handle faucet rate limits gracefully (retry after delay)
   // - Duration: ~5-15 seconds

   // Step 3: AI Strategy Decision
   // ┌─────────────────────────────────────────────────────┐
   // │  STEP 3/9 — AI Strategy Decision                    │
   // │  The Strategy Brain analyzes market conditions      │
   // └─────────────────────────────────────────────────────┘
   //
   // - Gather market context (SOL price, Fear/Greed, trends)
   // - Call StrategyBrain.decideAction(context)
   // - Display the AI's reasoning, confidence, and decision
   // - In demo mode, can override to always create a new token for showmanship
   // - Print: "🧠 AI Decision: {action} (confidence: {pct}%)"
   // - Print reasoning in a styled box
   // - Duration: ~3-5 seconds (LLM call)

   // Step 4: Generate Narrative
   // ┌─────────────────────────────────────────────────────┐
   // │  STEP 4/9 — Generate Token Narrative                │
   // │  The Narrative Agent creates a token concept        │
   // └─────────────────────────────────────────────────────┘
   //
   // - Call NarrativeAgent to generate token name, ticker, description, image concept
   // - Display the generated narrative with ASCII art preview
   // - Print: "🎨 Token: ${name} ($${ticker})"
   // - Print description and target audience
   // - Duration: ~3-5 seconds (LLM call)

   // Step 5: Create Token
   // ┌─────────────────────────────────────────────────────┐
   // │  STEP 5/9 — Create Token on Pump.fun               │
   // │  Minting the token on the bonding curve             │
   // └─────────────────────────────────────────────────────┘
   //
   // - Call CreatorAgent to create the token on Pump.fun (devnet)
   // - Display transaction signature with explorer link
   // - Show token mint address
   // - Print: "🪙 Token created! Mint: {mint}"
   // - Print: "🔗 https://solscan.io/token/{mint}?cluster=devnet"
   // - Duration: ~5-10 seconds (on-chain tx)

   // Step 6: Bundle Buy
   // ┌─────────────────────────────────────────────────────┐
   // │  STEP 6/9 — Bundle Buy (Multi-Wallet Acquisition)   │
   // │  Multiple agents buying simultaneously               │
   // └─────────────────────────────────────────────────────┘
   //
   // - Fund trader wallets from master wallet
   // - Execute coordinated buy via LaunchSequencer
   // - Show each wallet's buy amount and transaction
   // - Print summary: "💰 {N} wallets acquired {total} tokens"
   // - Duration: ~10-15 seconds (multiple txs)

   // Step 7: Start Trading
   // ┌─────────────────────────────────────────────────────┐
   // │  STEP 7/9 — Autonomous Trading                      │
   // │  Agents trading back and forth to generate volume   │
   // └─────────────────────────────────────────────────────┘
   //
   // - Start WashEngine with configured strategy
   // - Let it run for configurable duration (default 60 seconds)
   // - Show real-time trade log: "[TraderAgent-01] BUY 0.01 SOL → 42,000 tokens"
   // - Show running trade count and volume
   // - Print: "📈 Completed {N} trades, volume: {vol} SOL"
   // - Duration: ~30-120 seconds

   // Step 8: Show P&L
   // ┌─────────────────────────────────────────────────────┐
   // │  STEP 8/9 — Portfolio & P&L Summary                  │
   // │  How did the swarm perform?                         │
   // └─────────────────────────────────────────────────────┘
   //
   // - Query PnLTracker for current state
   // - Display per-agent P&L breakdown
   // - Show aggregate metrics: total P&L, ROI, win rate, max drawdown
   // - Display as formatted table with colors
   // - Duration: instant

   // Step 9: Exit Positions
   // ┌─────────────────────────────────────────────────────┐
   // │  STEP 9/9 — Exit & Cleanup                          │
   // │  Closing positions and reclaiming SOL               │
   // └─────────────────────────────────────────────────────┘
   //
   // - Coordinate exit via orchestrator.stop()
   // - Sell all tokens back to bonding curve
   // - Reclaim SOL from trader wallets to master wallet
   // - Show final balance vs starting balance
   // - Print: "✅ Reclaimed {amount} SOL to master wallet"
   // - Duration: ~10-20 seconds
   ```

6. **Faucet integration** (`requestDevnetAirdrop()`):
   ```typescript
   // Uses @solana/web3.js Connection.requestAirdrop()
   //
   // async requestDevnetAirdrop(
   //   connection: Connection,
   //   publicKey: PublicKey,
   //   amount: number
   // ): Promise<string> {
   //   const lamports = amount * LAMPORTS_PER_SOL;
   //   // Devnet faucet max is 2 SOL per request
   //   if (amount > 2) {
   //     // Split into multiple requests
   //     const requests = Math.ceil(amount / 2);
   //     for (let i = 0; i < requests; i++) {
   //       const requestAmount = Math.min(2, amount - i * 2);
   //       const sig = await connection.requestAirdrop(publicKey, requestAmount * LAMPORTS_PER_SOL);
   //       await connection.confirmTransaction(sig, 'confirmed');
   //       console.log(`  💧 Airdrop ${i + 1}/${requests}: ${requestAmount} SOL (tx: ${sig.slice(0, 12)}...)`);
   //       // Small delay between requests to avoid rate limiting
   //       if (i < requests - 1) await sleep(2000);
   //     }
   //   } else {
   //     const sig = await connection.requestAirdrop(publicKey, lamports);
   //     await connection.confirmTransaction(sig, 'confirmed');
   //     return sig;
   //   }
   // }
   //
   // Handle errors:
   // - 429 rate limit → wait 30s and retry (max 3 retries)
   // - Timeout → retry with exponential backoff
   // - Faucet down → show message and exit gracefully
   ```

7. **Countdown timer** (`waitWithCountdown()`):
   ```typescript
   // async waitWithCountdown(seconds: number, message: string): Promise<void> {
   //   for (let i = seconds; i > 0; i--) {
   //     process.stdout.write(`\r  ⏳ ${message}... ${i}s remaining  `);
   //     await sleep(1000);
   //   }
   //   process.stdout.write(`\r  ✅ ${message}... done!              \n`);
   // }
   ```

8. **Step banner formatting** (`printStepBanner()`):
   ```typescript
   // printStepBanner(step: number, total: number, title: string, description: string): void {
   //   console.log('');
   //   console.log(`  ${colors.cyan}┌${'─'.repeat(55)}┐${colors.reset}`);
   //   console.log(`  ${colors.cyan}│${colors.reset}  ${colors.bold}STEP ${step}/${total} — ${title}${' '.repeat(Math.max(0, 40 - title.length - String(step).length - String(total).length))}${colors.cyan}│${colors.reset}`);
   //   console.log(`  ${colors.cyan}│${colors.reset}  ${colors.dim}${description}${' '.repeat(Math.max(0, 53 - description.length))}${colors.cyan}│${colors.reset}`);
   //   console.log(`  ${colors.cyan}└${'─'.repeat(55)}┘${colors.reset}`);
   //   console.log('');
   // }
   ```

9. **Safety guardrails**:
   ```typescript
   // Demo mode enforced constraints:
   // - ALWAYS devnet (reject any mainnet config)
   // - Max budget: 5 SOL (devnet SOL is free, but prevents runaway)
   // - Max duration: 60 minutes
   // - Max trader agents: 5
   // - Auto-stop timer: kills the demo after maxDurationMinutes
   // - Cleanup always runs: even if demo fails midway, reclaim SOL
   // - All wallets are ephemeral (generated fresh, not saved to disk)
   ```

10. **Pause between steps** (for audience Q&A):
    ```typescript
    // If config.pauseBetweenSteps is true:
    // After each step, print:
    //   "  ⏸️  Press Enter to continue to the next step..."
    // Wait for user input via readline
    // This allows the presenter to explain what happened before moving on
    ```

### Success Criteria

- Demo runs entirely on devnet with faucet-funded SOL
- All 9 steps execute in sequence with clear visual output
- Each step shows a formatted banner with step number and description
- Faucet requests handle rate limits and retries gracefully
- Countdown timers provide visual feedback during waits
- Trading step shows real-time trade log for configured duration
- Final summary shows accurate P&L and session statistics
- Cleanup reclaims all SOL from demo wallets
- Mainnet is hard-blocked (`if (config.network !== 'devnet') throw ...`)

- Compiles with `npx tsc --noEmit`
