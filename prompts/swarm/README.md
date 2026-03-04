# Autonomous Memecoin Agent Swarm — Build Prompts

## Hackathon-Winning Demo: AI Agents Launch, Bundle, and Trade Memecoins

79 prompts organized into 9 phases. Each prompt is self-contained, designed for a Claude agent session. Feed them sequentially within each phase; phases can overlap where noted.

### Rules for All Agents

1. **Always work on current branch** (`main`)
2. **Always commit and push as `nirholas`** — `git config user.name "nirholas" && git config user.email "nirholas@users.noreply.github.com"`
3. **Always kill terminals** after use (`isBackground: true`, then `kill_terminal`)
4. **Unlimited Claude credits** — build the best possible version of everything
5. **No mocks, no fakes, no stubs** — real APIs, real agents, real mainnet, real money
6. **TypeScript strict mode** — no `any`, no `@ts-ignore`, no type assertions unless documented
7. **Build on existing infrastructure** — `packages/pump-agent-swarm/`, `packages/agent-runtime/`, `packages/mcp-server/`
8. **Every file must compile** — run `npx tsc --noEmit` after changes

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    SWARM ORCHESTRATOR                         │
│     Coordinates all agents, manages lifecycle & state        │
└──────┬───────────┬───────────┬───────────┬───────────┬───────┘
       │           │           │           │           │
┌──────▼──┐ ┌──────▼──┐ ┌──────▼──┐ ┌──────▼──┐ ┌──────▼──┐
│NARRATIVE│ │SCANNER  │ │CREATOR  │ │ BUNDLE  │ │  EXIT   │
│  AGENT  │ │ AGENT   │ │ AGENT   │ │COORD    │ │MANAGER  │
│ (idea)  │ │(find    │ │(mint    │ │(multi-  │ │(strat   │
│         │ │ coins)  │ │ tokens) │ │ wallet) │ │ exit)   │
└─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
       │           │           │           │           │
┌──────▼───────────▼───────────▼───────────▼───────────▼───────┐
│                    TRADER AGENT POOL                          │
│  N agents with independent wallets, trading back and forth   │
│  MarketMaker · VolumeBot · AccumulatorBot · SniperBot        │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                    INTELLIGENCE LAYER                         │
│  x402 Analytics · Bonding Curve Monitor · Holder Tracker     │
│  Social Sentiment · AI Signals · Risk Scoring                │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                    INFRASTRUCTURE                             │
│  Wallet Manager · RPC Pool · Jito Bundles · Priority Fees    │
│  Event Bus · State Machine · Logging · Metrics               │
└──────────────────────────────────────────────────────────────┘
```

### Phase Execution Order

| Phase | Prompts | What It Builds | Dependencies |
|-------|---------|----------------|--------------|
| 1 — Foundation | 01-09 | Infrastructure: RPC pool, wallet vault, event bus, state machine, config, logging | None |
| 2 — Agent Core | 10-19 | Core agents: Narrative, Scanner, enhanced Creator, enhanced Trader | Phase 1 |
| 3 — Trading Engine | 20-29 | Market making: wash engine, volume generation, price trajectory, wallet rotation | Phase 2 |
| 4 — Bundle System | 30-39 | Launch bundling: Jito integration, multi-wallet atomic buys, supply distribution | Phase 2 |
| 5 — Intelligence | 40-49 | AI brain: strategy decisions, signal generation, risk management, sentiment | Phase 1 |
| 6 — Coordination | 50-59 | A2A messaging: agent-to-agent protocol, swarm consensus, task delegation | Phase 2, 3, 4 |
| 7 — Dashboard | 60-69 | Live UI: real-time WebSocket, trade visualization, agent status, P&L charts | Phase 3, 4, 5 |
| 8 — Demo & Polish | 70-72 | Hackathon demo: CLI runner, one-click demo, presentation mode | All |
| 9 — Production Hardening | 73-79 | Tests, DB persistence, Telegram bot, package setup, barrel exports, Docker, profit consolidation | All |

### File Ownership Map

Each prompt specifies exactly which files it creates or modifies. No two prompts should create the same file.

```
packages/pump-agent-swarm/
├── src/
│   ├── index.ts                          # P01 (update exports)
│   ├── swarm.ts                          # P50 (major rewrite)
│   ├── types.ts                          # P01 (extend)
│   ├── strategies.ts                     # P20 (extend)
│   ├── wallet-manager.ts                 # P03 (enhance)
│   ├── config/
│   │   ├── index.ts                      # P06
│   │   ├── env.ts                        # P06
│   │   ├── defaults.ts                   # P06
│   │   └── validation.ts                 # P06
│   ├── infra/
│   │   ├── rpc-pool.ts                   # P02
│   │   ├── event-bus.ts                  # P04
│   │   ├── state-machine.ts             # P05
│   │   ├── logger.ts                     # P07
│   │   ├── metrics.ts                    # P08
│   │   └── error-handler.ts             # P09
│   ├── agents/
│   │   ├── creator-agent.ts              # P12 (enhance)
│   │   ├── trader-agent.ts               # P13 (enhance)
│   │   ├── narrative-agent.ts            # P10
│   │   ├── scanner-agent.ts              # P11
│   │   ├── sniper-agent.ts              # P14
│   │   ├── market-maker-agent.ts        # P15
│   │   ├── volume-agent.ts              # P16
│   │   ├── accumulator-agent.ts         # P17
│   │   ├── exit-agent.ts               # P18
│   │   └── sentinel-agent.ts           # P19
│   ├── trading/
│   │   ├── wash-engine.ts               # P20
│   │   ├── volume-generator.ts          # P21
│   │   ├── price-trajectory.ts          # P22
│   │   ├── wallet-rotation.ts           # P23
│   │   ├── trade-scheduler.ts           # P24
│   │   ├── order-router.ts             # P25
│   │   ├── slippage-calculator.ts       # P26
│   │   ├── gas-optimizer.ts             # P27
│   │   ├── position-manager.ts          # P28
│   │   ├── pnl-tracker.ts              # P29
│   │   └── profit-consolidator.ts      # P79
│   ├── bundle/
│   │   ├── bundle-coordinator.ts        # P30
│   │   ├── jito-client.ts              # P31
│   │   ├── supply-distributor.ts        # P32
│   │   ├── anti-detection.ts           # P33
│   │   ├── timing-engine.ts            # P34
│   │   ├── bundle-validator.ts          # P35
│   │   ├── launch-sequencer.ts          # P36
│   │   ├── dev-buy-optimizer.ts         # P37
│   │   ├── wallet-funder.ts            # P38
│   │   └── bundle-analytics.ts          # P39
│   ├── intelligence/
│   │   ├── strategy-brain.ts            # P40
│   │   ├── signal-generator.ts          # P41
│   │   ├── risk-manager.ts             # P42
│   │   ├── sentiment-analyzer.ts        # P43
│   │   ├── trend-detector.ts           # P44
│   │   ├── token-evaluator.ts          # P45
│   │   ├── market-regime.ts            # P46
│   │   ├── alpha-scanner.ts            # P47
│   │   ├── narrative-generator.ts       # P48
│   │   └── portfolio-optimizer.ts       # P49
│   ├── coordination/
│   │   ├── swarm-orchestrator.ts        # P50
│   │   ├── agent-messenger.ts          # P51
│   │   ├── consensus-engine.ts          # P52
│   │   ├── task-delegator.ts           # P53
│   │   ├── lifecycle-manager.ts         # P54
│   │   ├── health-monitor.ts           # P55
│   │   ├── phase-controller.ts          # P56
│   │   ├── rollback-manager.ts          # P57
│   │   ├── audit-logger.ts             # P58
│   │   └── swarm-config-manager.ts      # P59
│   ├── dashboard/
│   │   ├── server.ts                    # P60
│   │   ├── websocket.ts                # P61
│   │   ├── api-routes.ts               # P62
│   │   ├── trade-visualizer.ts          # P63
│   │   ├── agent-monitor.ts            # P64
│   │   ├── pnl-dashboard.ts            # P65
│   │   ├── supply-chart.ts             # P66
│   │   ├── event-timeline.ts           # P67
│   │   ├── alert-manager.ts            # P68
│   │   └── export-manager.ts           # P69
│   ├── analytics/
│   │   └── x402-client.ts              # existing (enhance in P08)
│   ├── demo/
│   │   ├── cli-runner.ts               # P70
│   │   ├── demo-mode.ts               # P71
│   │   └── presentation.ts            # P72
│   ├── persistence/
│   │   ├── index.ts                    # P74
│   │   ├── schema.ts                   # P74
│   │   ├── database.ts                 # P74
│   │   ├── repositories.ts             # P74
│   │   └── migrations.ts              # P74
│   ├── telegram/
│   │   ├── index.ts                    # P75
│   │   ├── bot.ts                      # P75
│   │   ├── commands.ts                 # P75
│   │   ├── notifications.ts            # P75
│   │   └── formatters.ts              # P75
│   └── examples/
│       └── run-swarm.ts                # existing (update in P72)
├── Dockerfile                            # P78
├── docker-compose.yml                    # P78
├── .env.example                          # P78
├── vitest.config.ts                      # P73
├── tsconfig.build.json                   # P76
├── deploy/
│   ├── cloudrun.yaml                    # P78
│   └── k8s-deployment.yaml              # P78
└── src/__tests__/                         # P73 (full test structure)
```
