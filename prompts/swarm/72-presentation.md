# Prompt 72 — Presentation Mode

## Agent Identity & Rules

```
You are the PRESENTATION-MODE builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real AI narration, real demo execution, real-time commentary
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add AI-narrated presentation mode for hackathon demo"
```

## Objective

Create `packages/pump-agent-swarm/src/demo/presentation.ts` — an enhanced demo mode specifically designed for hackathon judging. Builds on DemoMode (P71) by adding AI-generated real-time commentary that explains what's happening and why it matters, formatted output for screen sharing, and a comprehensive post-demo summary.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/demo/presentation.ts`
- **Updates**: `packages/pump-agent-swarm/src/examples/run-swarm.ts` — update to import and use SwarmCLI as default entry point

## Dependencies

- `./demo-mode` — DemoMode, DemoConfig, DemoResult (P71)
- `../intelligence/strategy-brain` — StrategyBrain (OpenRouter integration) (P40)
- `../infra/event-bus` — SwarmEventBus (P04)
- `../infra/logging` — SwarmLogger (P07)
- `../dashboard/server` — DashboardServer (P60)
- `../dashboard/export-manager` — ExportManager (P69)

## Deliverables

### Create `packages/pump-agent-swarm/src/demo/presentation.ts`

1. **`PresentationMode` class**:
   - `constructor(config?: PresentationConfig)`
   - `runPresentation(): Promise<void>` — execute the full narrated presentation
   - `setNarrationSpeed(speed: 'slow' | 'normal' | 'fast'): void` — adjust pacing
   - `toggleNarration(enabled: boolean): void` — enable/disable AI narration
   - `abort(): Promise<void>` — abort and generate partial summary

2. **`PresentationConfig` interface**:
   ```typescript
   interface PresentationConfig {
     /** All DemoConfig options */
     demo: Partial<DemoConfig>;
     /** OpenRouter API key for narration */
     openRouterApiKey: string;
     /** OpenRouter model for narration (default: 'google/gemini-2.0-flash-001') */
     narrationModel: string;
     /** Narration speed */
     narrationSpeed: 'slow' | 'normal' | 'fast';
     /** Show technical details alongside narration */
     showTechnicalDetails: boolean;
     /** Presenter name for personalized narration */
     presenterName?: string;
     /** Project name for narration context */
     projectName: string;
     /** Hackathon name for context */
     hackathonName?: string;
     /** Audience type for tailored narration */
     audience: 'technical' | 'investor' | 'general';
     /** Enable dashboard alongside (default: true) */
     enableDashboard: boolean;
   }
   ```

3. **AI Narration system**:
   - After each major event, call OpenRouter to generate a 1-3 sentence explanation
   - System prompt:
     ```
     You are a live demo narrator for a hackathon presentation. The project is an 
     autonomous AI agent swarm that launches and trades memecoins on Solana.
     
     For each event, provide a brief, engaging narration that:
     1. Explains what just happened in plain English
     2. Why it's technically impressive
     3. How it demonstrates autonomous agent coordination
     
     Keep it concise (1-3 sentences). Be enthusiastic but not cringy.
     Audience: {audience}. Presenter: {presenterName}.
     ```
   - Narration events:
     - Wallet generation: "The swarm just created 5 independent Solana wallets, each controlled by a different AI agent..."
     - AI strategy decision: "The Strategy Brain analyzed market conditions and decided to..."
     - Token creation: "An AI agent just autonomously created a new token on Pump.fun..."
     - Bundle buy: "Multiple AI agents coordinated to buy tokens in the same Solana slot..."
     - Each trade: "Agent Trader-2 just detected a buy signal and executed a 0.5 SOL purchase..."
     - P&L milestones: "The swarm is now profitable! Aggregate P&L just crossed +0.1 SOL..."

4. **Formatted output for screen sharing**:
   ```
   ╔═══════════════════════════════════════════════════════════════╗
   ║          🤖 AUTONOMOUS MEMECOIN AGENT SWARM                  ║
   ║          Live Demo — {hackathonName}                         ║
   ╠═══════════════════════════════════════════════════════════════╣
   ║                                                              ║
   ║  "The swarm just created 5 independent wallets, each         ║
   ║   controlled by a different AI agent with its own            ║
   ║   strategy and decision-making capabilities."                ║
   ║                                                              ║
   ╠═══════════════════════════════════════════════════════════════╣
   ║  STEP 1/9 ████████████░░░░░░░░░░░░░░░░░░░░  33%            ║
   ║  Phase: WALLET GENERATION                                    ║
   ║  Elapsed: 0:34                                               ║
   ╠═══════════════════════════════════════════════════════════════╣
   ║                                                              ║
   ║  ✅ Creator Agent    — 7xKz...4mNp   2.0 SOL               ║
   ║  ✅ Trader Agent #1  — 3bFq...8vRs   2.0 SOL               ║
   ║  ✅ Trader Agent #2  — 9dJw...2cTk   2.0 SOL               ║
   ║  ⏳ Trader Agent #3  — 5gLm...6xHn   funding...            ║
   ║  ⏳ Sentinel Agent   — 1aRv...7pQs   pending               ║
   ║                                                              ║
   ╠═══════════════════════════════════════════════════════════════╣
   ║  💰 Budget: 10.0 SOL  │  📊 Trades: 0  │  📈 P&L: 0.0 SOL  ║
   ╚═══════════════════════════════════════════════════════════════╝
   ```

5. **Key metrics bar** (always visible at bottom):
   ```typescript
   interface MetricsBar {
     budget: number;
     spent: number;
     pnl: number;
     roi: number;
     trades: number;
     agents: number;
     phase: string;
     elapsed: string;
   }
   ```

6. **Post-demo summary** (generated after demo completes):
   ```
   ╔═══════════════════════════════════════════════════════════════╗
   ║                  📋 DEMO SUMMARY                             ║
   ╠═══════════════════════════════════════════════════════════════╣
   ║                                                              ║
   ║  Duration:        5 minutes 34 seconds                       ║
   ║  Token Created:   $AISWARM (8xPq...3mKv)                    ║
   ║  Agents Deployed: 5                                          ║
   ║  Total Trades:    47                                         ║
   ║  Volume:          12.4 SOL                                   ║
   ║  Final P&L:       +0.32 SOL (+6.4% ROI)                     ║
   ║  Max Drawdown:    -0.08 SOL (-1.6%)                          ║
   ║                                                              ║
   ║  🏆 HIGHLIGHTS                                               ║
   ║  • AI autonomously chose "create new token" strategy         ║
   ║  • 5 agents coordinated bundle buy in same Solana slot       ║
   ║  • Market-making agent maintained organic volume pattern     ║
   ║  • Sentinel detected and avoided a 3% slippage trade        ║
   ║  • All agents profitable at session end                      ║
   ║                                                              ║
   ║  🧠 AI DECISIONS MADE                                        ║
   ║  • Strategy selection (confidence: 87%)                      ║
   ║  • 12 buy/sell signals generated from on-chain data          ║
   ║  • 3 risk assessments prevented oversized trades             ║
   ║  • 1 strategy adaptation (ORGANIC → VOLUME at minute 3)      ║
   ║                                                              ║
   ╚═══════════════════════════════════════════════════════════════╝
   
   "What you just witnessed was a fully autonomous AI agent swarm
    that created, launched, and traded a memecoin with zero human
    intervention. Each agent made independent decisions using
    on-chain data and AI reasoning, coordinating through an
    event-driven architecture to achieve a collective goal."
   
   Full session report: ./swarm-session-1709567890.json
   Dashboard replay: http://localhost:3847
   ```

7. **`generateNarration` method**:
   ```typescript
   private async generateNarration(
     event: string,
     context: Record<string, unknown>
   ): Promise<string>
   ```
   - Calls OpenRouter `https://openrouter.ai/api/v1/chat/completions`
   - Model: configurable (default `google/gemini-2.0-flash-001`)
   - Max tokens: 150 (keep narration concise)
   - Temperature: 0.7 (creative but coherent)
   - Timeout: 5 seconds (don't hold up the demo)
   - On failure: use fallback static narration (pre-written for each event)

8. **`generateSummary` method**:
   ```typescript
   private async generateSummary(
     result: DemoResult
   ): Promise<PresentationSummary>
   ```
   ```typescript
   interface PresentationSummary {
     /** Generated closing statement */
     closingStatement: string;
     /** Key highlights extracted from demo */
     highlights: string[];
     /** AI decisions made during demo */
     aiDecisions: Array<{
       type: string;
       description: string;
       confidence: number;
     }>;
     /** Technical metrics */
     metrics: {
       duration: string;
       tokenMint: string | null;
       agentCount: number;
       tradeCount: number;
       totalVolume: number;
       finalPnl: number;
       roi: number;
       maxDrawdown: number;
     };
   }
   ```

### Update `packages/pump-agent-swarm/src/examples/run-swarm.ts`

Update the existing example file to import and offer three modes:
```typescript
import { SwarmCLI } from '../demo/cli-runner.js';
import { DemoMode } from '../demo/demo-mode.js';
import { PresentationMode } from '../demo/presentation.js';

const mode = process.argv[2] || 'cli';

switch (mode) {
  case 'demo':
    await new DemoMode().runDemo();
    break;
  case 'present':
    await new PresentationMode().runPresentation();
    break;
  case 'cli':
  default:
    await new SwarmCLI().run();
    break;
}
```

### Success Criteria

- Presentation runs end-to-end with AI narration at each step
- OpenRouter API called successfully for narration generation
- Fallback narration used when API fails (no demo interruption)
- Output formatted for screen sharing / projector readability
- Post-demo summary includes highlights and AI decision count
- Metrics bar always visible showing key stats
- Dashboard accessible alongside terminal presentation
- Session report exported on completion
- Updated run-swarm.ts supports `demo`, `present`, and `cli` modes
- Compiles with `npx tsc --noEmit`
