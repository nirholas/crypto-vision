# Prompt 72 — Presentation Mode

## Agent Identity & Rules

```
You are the PRESENTATION-MODE builder. This is the FINAL prompt — the grand finale of the 72-prompt architecture.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real devnet transactions, real AI narration, real visualizations
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add presentation mode with AI narration and hackathon-ready demo output"
```

## Objective

Create `packages/pump-agent-swarm/src/demo/presentation.ts` — an enhanced version of DemoMode specifically designed for hackathon judging and live presentations. Everything from DemoMode PLUS: AI-generated real-time commentary explaining what's happening and why it matters, output formatted for screen sharing / projector display, key metrics highlighted with ASCII art and box-drawing characters, timestamped actions for judges, and a comprehensive post-demo summary with highlights. Also updates `packages/pump-agent-swarm/src/examples/run-swarm.ts` to import and use `SwarmCLI` as an entry point.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/demo/presentation.ts`
- **Modifies**: `packages/pump-agent-swarm/src/examples/run-swarm.ts`

## Dependencies

- `./demo-mode` — `DemoMode`, `DemoConfig`, `DemoResult`, `StepResult` (P71)
- `./cli-runner` — `SwarmCLI` (P70)
- `../coordination/swarm-orchestrator` — `SwarmOrchestrator` (P50)
- `../coordination/audit-logger` — `AuditLogger` (P58)
- `../infra/event-bus` — `SwarmEventBus` (P04)
- `../infra/logger` — `SwarmLogger` (P07)
- `../trading/pnl-tracker` — `PnLTracker` (P29)
- `../dashboard/export-manager` — `ExportManager` (P69)
- `@solana/web3.js` — `Connection`, `Keypair`

## Deliverables

### Create `packages/pump-agent-swarm/src/demo/presentation.ts`

1. **`PresentationMode` class** (extends or wraps `DemoMode`):
   - `constructor(config?: Partial<PresentationConfig>)`
   - `runPresentation(config?: Partial<PresentationConfig>): Promise<void>` — main entry: runs the full presentation
   - `narrateEvent(event: string, context: Record<string, unknown>): Promise<string>` — AI-generated commentary for an event
   - `showTitleCard(): void` — large ASCII art title for opening
   - `showChapterCard(chapter: number, title: string): void` — chapter transition cards
   - `highlightMetric(label: string, value: string | number, trend?: 'up' | 'down' | 'neutral'): void` — big formatted metric display
   - `showTradeAnimation(trade: TradeEvent): void` — animated trade execution display
   - `showAgentThinking(agentName: string, thought: string): void` — display what an agent is "thinking"
   - `generateHighlights(result: DemoResult): Promise<PresentationHighlight[]>` — AI-curated session highlights
   - `showClosingCard(result: DemoResult): void` — closing summary for judges
   - `exportPresentationLog(): string` — timestamped log of everything shown

2. **`PresentationConfig` interface** (extends `DemoConfig`):
   ```typescript
   interface PresentationConfig extends DemoConfig {
     /** AI model for narration (default: google/gemini-2.0-flash-001) */
     narrationModel: string;
     /** Delay between narrative statements (ms) for readability */
     narrationDelay: number;
     /** Use large/bold output formatted for projectors */
     projectorMode: boolean;
     /** Terminal width override (default: process.stdout.columns or 120) */
     terminalWidth: number;
     /** Show agent "thinking" bubbles before actions */
     showAgentThoughts: boolean;
     /** Record timestamps for every display event */
     recordTimestamps: boolean;
     /** Color theme: 'dark' (light text) or 'light' (dark text) */
     theme: 'dark' | 'light';
     /** Presentation title (shown on title card) */
     title: string;
     /** Team name (shown on title card) */
     teamName: string;
     /** Hackathon name (shown on title card) */
     hackathonName: string;
   }
   ```

3. **`PresentationHighlight` interface**:
   ```typescript
   interface PresentationHighlight {
     /** Timestamp of the event */
     timestamp: number;
     /** Category of highlight */
     category: 'trade' | 'ai-decision' | 'milestone' | 'metric' | 'narrative';
     /** Short title */
     title: string;
     /** Detailed description */
     description: string;
     /** Associated metric value (if applicable) */
     metricValue?: string;
     /** Why this is noteworthy (AI-generated) */
     significance: string;
   }
   ```

4. **`TradeEvent` interface** (for animation):
   ```typescript
   interface TradeEvent {
     agentId: string;
     agentType: string;
     direction: 'BUY' | 'SELL';
     solAmount: number;
     tokenAmount: number;
     price: number;
     signature: string;
     timestamp: number;
   }
   ```

5. **`PresentationLog` interface**:
   ```typescript
   interface PresentationLog {
     /** Session metadata */
     session: {
       title: string;
       teamName: string;
       hackathonName: string;
       startedAt: number;
       endedAt: number;
       totalDuration: number;
     };
     /** Chronological display events */
     events: Array<{
       timestamp: number;
       elapsed: string;
       type: 'title' | 'chapter' | 'narration' | 'metric' | 'trade' | 'thought' | 'highlight' | 'summary';
       content: string;
     }>;
     /** Final results */
     result: DemoResult;
     /** AI-curated highlights */
     highlights: PresentationHighlight[];
   }
   ```

6. **Title card** (`showTitleCard()`):
   ```typescript
   // Display large ASCII art title card:
   //
   //  ██████╗██████╗ ██╗   ██╗██████╗ ████████╗ ██████╗
   // ██╔════╝██╔══██╗╚██╗ ██╔╝██╔══██╗╚══██╔══╝██╔═══██╗
   // ██║     ██████╔╝ ╚████╔╝ ██████╔╝   ██║   ██║   ██║
   // ██║     ██╔══██╗  ╚██╔╝  ██╔═══╝    ██║   ██║   ██║
   // ╚██████╗██║  ██║   ██║   ██║        ██║   ╚██████╔╝
   //  ╚═════╝╚═╝  ╚═╝   ╚═╝   ╚═╝        ╚═╝    ╚═════╝
   //
   //    ██╗   ██╗██╗███████╗██╗ ██████╗ ███╗   ██╗
   //    ██║   ██║██║██╔════╝██║██╔═══██╗████╗  ██║
   //    ██║   ██║██║███████╗██║██║   ██║██╔██╗ ██║
   //    ╚██╗ ██╔╝██║╚════██║██║██║   ██║██║╚██╗██║
   //     ╚████╔╝ ██║███████║██║╚██████╔╝██║ ╚████║
   //      ╚═══╝  ╚═╝╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝
   //
   //       🐝 Autonomous Agent Swarm for Pump.fun
   //
   //    ┌────────────────────────────────────────────┐
   //    │  Team: {teamName}                          │
   //    │  Event: {hackathonName}                    │
   //    │  Date: {date}                              │
   //    └────────────────────────────────────────────┘
   //
   // Hold for config.narrationDelay ms before continuing
   ```

7. **Chapter cards** (`showChapterCard()`):
   ```typescript
   // Between major sections, show a chapter transition:
   //
   //  ═══════════════════════════════════════════════
   //   CHAPTER {n}: {TITLE}
   //  ═══════════════════════════════════════════════
   //
   // Chapters map to demo phases:
   //  Chapter 1: "INITIALIZATION" (wallets + funding)
   //  Chapter 2: "INTELLIGENCE" (AI strategy + narrative)
   //  Chapter 3: "CREATION" (token launch + bundle)
   //  Chapter 4: "TRADING" (autonomous trading)
   //  Chapter 5: "RESULTS" (P&L + highlights)
   ```

8. **AI narration** (`narrateEvent()`):
   ```typescript
   // After each major event, call OpenRouter API to generate
   // a 1-2 sentence explanation of what just happened and why
   // it matters, written for a non-technical audience.
   //
   // POST https://openrouter.ai/api/v1/chat/completions
   // {
   //   model: config.narrationModel,
   //   messages: [
   //     {
   //       role: 'system',
   //       content: `You are a live hackathon presentation narrator for an autonomous 
   //         AI agent swarm that trades memecoins on Solana. Generate a brief, 
   //         engaging 1-2 sentence commentary on what just happened. Be enthusiastic 
   //         but accurate. Explain significance for judges who may not know crypto deeply. 
   //         Keep it under 50 words.`
   //     },
   //     {
   //       role: 'user',
   //       content: JSON.stringify({ event, context })
   //     }
   //   ],
   //   max_tokens: 100,
   //   temperature: 0.7
   // }
   //
   // Display narration in a styled quote block:
   //  │
   //  │  🎙️  "The Strategy Brain just made its first autonomous decision —
   //  │       analyzing SOL price trends, social sentiment, and on-chain data
   //  │       to determine the optimal token launch strategy."
   //  │
   //
   // If OpenRouter call fails, fall back to pre-written narration templates
   ```

9. **Metric highlights** (`highlightMetric()`):
   ```typescript
   // Display a single metric in large format for projector visibility:
   //
   //  ┌──────────────────────────┐
   //  │  TOTAL TRADES            │
   //  │                          │
   //  │       ██ 247 ██          │
   //  │          ▲               │
   //  └──────────────────────────┘
   //
   // For P&L with trend:
   //  ┌──────────────────────────┐
   //  │  PROFIT & LOSS           │
   //  │                          │
   //  │  ✅ +0.42 SOL (+42%)     │
   //  │          📈              │
   //  └──────────────────────────┘
   //
   // Use green for positive values, red for negative
   // ▲/▼ arrows for trend direction
   ```

10. **Trade animation** (`showTradeAnimation()`):
    ```typescript
    // Animated trade execution display:
    //
    // ─── TRADE #47 ──────────────────────────────────────────
    //  🤖 MarketMaker-01                    ⏱️  14:23:45
    //  ├─ Direction: 🟢 BUY
    //  ├─ Amount:    0.015 SOL → 63,200 tokens
    //  ├─ Price:     0.000000237 SOL/token
    //  ├─ Signature: 3xKa...7nPq
    //  └─ Status:    ✅ Confirmed
    // ────────────────────────────────────────────────────────
    //
    // Brief pause (200ms) between trade displays for readability
    ```

11. **Agent thinking** (`showAgentThinking()`):
    ```typescript
    // Show what an agent is "thinking" before it acts:
    //
    //  💭 StrategyBrain is thinking...
    //  ┌─────────────────────────────────────────────┐
    //  │  "SOL is up 3% today, Fear & Greed index    │
    //  │   is at 72 (Greed). Trending narratives:    │
    //  │   AI agents, cat coins. I recommend          │
    //  │   launching an AI-themed token now."         │
    //  └─────────────────────────────────────────────┘
    //
    // Only shown if config.showAgentThoughts is true
    ```

12. **Post-demo highlights** (`generateHighlights()`):
    ```typescript
    // After the demo completes, use AI to curate the most
    // interesting moments and generate a highlights reel:
    //
    //  ═══════════════════════════════════════════════
    //   📌 SESSION HIGHLIGHTS
    //  ═══════════════════════════════════════════════
    //
    //  🏆 Best Trade
    //     MarketMaker-01 bought at 0.0000002 and sold at 0.0000003
    //     "A 50% return in 12 seconds — the AI identified a micro-dip
    //      in the bonding curve and executed instantly."
    //
    //  🧠 Smartest Decision
    //     Strategy Brain switched from VOLUME to GRADUATION strategy
    //     "When the token reached 60 SOL in the curve, the brain
    //      recognized graduation was achievable and pivoted strategy."
    //
    //  🎯 Key Milestone
    //     Token reached 100 unique holders in 3 minutes
    //     "Organic adoption exceeded expectations, validating the
    //      AI-generated narrative resonated with the community."
    //
    //  ⚡ Coordination Showcase
    //     5 agents executed 12 trades in a single block
    //     "Demonstrating the power of multi-agent coordination
    //      with sub-second reaction times."
    //
    // Feed the full DemoResult to OpenRouter and ask it to identify
    // the 3-5 most impressive/noteworthy moments for the judges
    ```

13. **Closing card** (`showClosingCard()`):
    ```typescript
    // Final display for judges:
    //
    //  ╔════════════════════════════════════════════════════╗
    //  ║                                                    ║
    //  ║            🏆 DEMO COMPLETE 🏆                     ║
    //  ║                                                    ║
    //  ╠════════════════════════════════════════════════════╣
    //  ║                                                    ║
    //  ║   Duration:        5 minutes 23 seconds            ║
    //  ║   Agents Active:   7                               ║
    //  ║   Total Trades:    247                              ║
    //  ║   Trading Volume:  4.56 SOL                        ║
    //  ║   Final P&L:       +0.42 SOL (+42.0%)              ║
    //  ║   Win Rate:        64.1%                           ║
    //  ║   Max Drawdown:    -8.3%                           ║
    //  ║                                                    ║
    //  ╠════════════════════════════════════════════════════╣
    //  ║                                                    ║
    //  ║   🔑 Key Technologies:                             ║
    //  ║   • Multi-agent AI coordination (A2A protocol)     ║
    //  ║   • Real-time on-chain data processing             ║
    //  ║   • LLM-powered autonomous strategy decisions      ║
    //  ║   • Solana transaction bundling (Jito)              ║
    //  ║   • Risk management with circuit breakers          ║
    //  ║                                                    ║
    //  ╠════════════════════════════════════════════════════╣
    //  ║                                                    ║
    //  ║   Team: {teamName}                                 ║
    //  ║   Event: {hackathonName}                           ║
    //  ║   Built with: Crypto Vision + Pump.fun SDK         ║
    //  ║                                                    ║
    //  ╚════════════════════════════════════════════════════╝
    //
    // Hold for 5 seconds before printing "Thank you!" message
    ```

14. **Presentation flow** (`runPresentation()`):
    ```typescript
    // The full presentation sequence:
    //
    // 1. showTitleCard() — dramatic opening
    // 2. narrateEvent('presentation-start', { config }) — "Welcome to..."
    //
    // 3. showChapterCard(1, 'INITIALIZATION')
    //    - Run DemoMode steps: generate-wallets, fund-from-faucet
    //    - narrateEvent after each step
    //
    // 4. showChapterCard(2, 'INTELLIGENCE')
    //    - Run DemoMode steps: ai-strategy-decision, generate-narrative
    //    - showAgentThinking for StrategyBrain
    //    - narrateEvent after each step
    //
    // 5. showChapterCard(3, 'CREATION')
    //    - Run DemoMode steps: create-token, bundle-buy
    //    - showTradeAnimation for bundle buys
    //    - narrateEvent after each step
    //
    // 6. showChapterCard(4, 'TRADING')
    //    - Run DemoMode step: start-trading
    //    - showTradeAnimation for notable trades
    //    - highlightMetric for trade count, volume at regular intervals
    //    - narrateEvent at milestones (every 50 trades, etc.)
    //
    // 7. showChapterCard(5, 'RESULTS')
    //    - Run DemoMode steps: show-pnl, exit-positions
    //    - highlightMetric for each key metric
    //    - generateHighlights()
    //    - showClosingCard()
    //    - narrateEvent('presentation-end', { result })
    //
    // 8. exportPresentationLog() — save full log for submission
    ```

15. **Fallback narration templates** (when AI is unavailable):
    ```typescript
    const FALLBACK_NARRATIONS: Record<string, string> = {
      'generate-wallets': 'The swarm just generated a pool of ephemeral wallets — each agent gets its own identity on-chain.',
      'fund-from-faucet': 'Devnet SOL has been distributed to all agent wallets. Zero cost, full functionality.',
      'ai-strategy-decision': 'The Strategy Brain analyzed market conditions across multiple data sources and made an autonomous decision.',
      'generate-narrative': 'Our Narrative Agent used AI to create a compelling token concept aligned with current market trends.',
      'create-token': 'A new token has been minted on the Pump.fun bonding curve — a real on-chain asset created by an AI agent.',
      'bundle-buy': 'Multiple agents executed coordinated purchases in a single atomic bundle — this is multi-agent coordination in action.',
      'start-trading': 'The trading swarm is now live — agents are autonomously buying and selling to generate organic-looking market activity.',
      'show-pnl': 'Here are the results — every trade tracked, every position accounted for, every agent\'s performance measured.',
      'exit-positions': 'The swarm is gracefully unwinding all positions and reclaiming capital. Clean shutdown, zero losses from exit.',
      'presentation-start': 'Welcome to Crypto Vision — an autonomous AI agent swarm that coordinates to trade memecoins on Solana.',
      'presentation-end': 'That concludes our demo. What you witnessed was fully autonomous — no human intervention from start to finish.',
    };
    ```

### Update `packages/pump-agent-swarm/src/examples/run-swarm.ts`

```typescript
// Replace or update the existing run-swarm.ts to use SwarmCLI:
//
// import { SwarmCLI } from '../demo/cli-runner.js';
// import { PresentationMode } from '../demo/presentation.js';
// import { DemoMode } from '../demo/demo-mode.js';
//
// const mode = process.argv[2] || 'cli';
//
// async function main(): Promise<void> {
//   switch (mode) {
//     case 'demo':
//       console.log('🎮 Starting Demo Mode (devnet)...');
//       const demo = new DemoMode();
//       await demo.runDemo();
//       break;
//
//     case 'present':
//     case 'presentation':
//       console.log('🎤 Starting Presentation Mode (devnet)...');
//       const presentation = new PresentationMode({
//         title: 'Crypto Vision Agent Swarm',
//         teamName: process.env.TEAM_NAME || 'Crypto Vision',
//         hackathonName: process.env.HACKATHON_NAME || 'Hackathon 2025',
//       });
//       await presentation.runPresentation();
//       break;
//
//     case 'cli':
//     default:
//       const cli = new SwarmCLI();
//       await cli.run();
//       break;
//   }
// }
//
// main().catch((error) => {
//   console.error('Fatal:', error);
//   process.exit(1);
// });
//
// Usage:
//   npx tsx packages/pump-agent-swarm/src/examples/run-swarm.ts          # Interactive CLI
//   npx tsx packages/pump-agent-swarm/src/examples/run-swarm.ts demo     # Guided demo
//   npx tsx packages/pump-agent-swarm/src/examples/run-swarm.ts present  # Hackathon presentation
```

### Success Criteria

- Presentation inherits all DemoMode functionality (devnet, faucet, safety guardrails)
- AI narration generates engaging 1-2 sentence commentary after each major event
- Title card displays large ASCII art visible on projectors
- Chapter cards provide clear visual transitions between phases
- Metric highlights use large formatted display suitable for screen sharing
- Trade animations show each trade with agent identity and status
- Agent "thinking" bubbles display before major decisions
- Post-demo highlights curate 3-5 most noteworthy moments with AI explanation
- Closing card summarizes all key metrics and technologies in a judge-friendly format
- Fallback narration templates ensure presentation works even without OpenRouter API key
- `run-swarm.ts` updated with three modes: cli, demo, presentation
- Full presentation log is exportable as timestamped JSON
- All timestamps recorded relative to presentation start for judges
- Compiles with `npx tsc --noEmit`
