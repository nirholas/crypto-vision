# Prompt 07 — Pump Agent Swarm: Complete All 10 Agent Types

## Context

You are working on `packages/pump-agent-swarm/src/agents/` in the crypto-vision monorepo. There are 10 agent types (plus a market-maker agent). Each agent is an autonomous actor in the swarm that operates on Solana's Pump.fun bonding curve.

The agents communicate via an `EventBus` (in `src/infra/event-bus.ts`) and are orchestrated by the `SwarmCoordinator` (in `src/swarm.ts`).

Key types from `src/types.ts`:
- `AgentRole`: creator | trader | analyst | sniper | market_maker | volume_bot | accumulator | exit_manager | sentinel | scanner | narrator
- `AgentIdentity`: { id, name, role, wallet, config, active, createdAt, lastHeartbeat }
- `TradeOrder`, `TradeResult`, `BondingCurveState`, `TradingStrategy`

The trading engine is in `src/trading/` with: `OrderRouter`, `PositionManager`, `PnLTracker`, `TradeScheduler`, `GasOptimizer`.

## Task

Review and complete each agent implementation. Every agent must:
1. Have a constructor that takes config + dependencies (wallet, RPC, event bus)
2. Implement a `start()` method that begins autonomous operation
3. Implement a `stop()` method for graceful shutdown
4. Emit events via the EventBus for monitoring
5. Handle errors with retry + backoff
6. Track its own stats (trades, success rate, PnL)
7. Follow the assigned `TradingStrategy` rules

### Agent Implementations

#### 1. Creator Agent (`creator-agent.ts`)
- Mints new tokens on Pump.fun using `createV2Instruction`
- Configures bonding curve parameters
- Executes atomic dev buy with the mint transaction
- Emits `token:created` event with `MintResult`

#### 2. Trader Agent (`trader-agent.ts`)
- Executes buy/sell orders on the bonding curve per strategy
- Respects `minIntervalSeconds`/`maxIntervalSeconds` between trades
- Respects `buySellRatio` for buy vs sell distribution
- Tracks position via `PositionManager`
- Stops when `maxTrades` or `maxDurationSeconds` reached
- Stops when budget exhausted

#### 3. Sniper Agent (`sniper-agent.ts`)
- Monitors for new token launches (via scanner or event bus)
- Executes rapid entry buys within first seconds of launch
- Uses Jito bundles for speed
- Configurable entry criteria (min liquidity, bonding curve shape)
- Auto-exits after target profit or time

#### 4. Market Maker Agent (`market-maker-agent.ts`)
- Places alternating buy/sell orders to provide liquidity
- Maintains a spread around current price
- Inventory management: rebalances when position drifts
- Uses smaller order sizes than trader agents
- Higher trade frequency, tighter intervals

#### 5. Volume Agent (`volume-agent.ts`)
- Generates organic-looking trading volume
- Randomized trade sizes within range
- Randomized intervals with human-like patterns (slower at night, faster during peaks)
- Self-washing: buys then sells (or vice versa) to inflate volume
- Uses `WashEngine` and `VolumeGenerator` from trading engine

#### 6. Accumulator Agent (`accumulator-agent.ts`)
- DCA strategy: buys fixed amounts at regular intervals
- Increases buy size on dips (buy-the-dip logic)
- Never sells — accumulation only
- Budget tracking with stop at limit
- Reports accumulation progress

#### 7. Exit Agent (`exit-agent.ts`)
- Manages coordinated profit-taking exits
- Takes profit in tranches (25%, 25%, 25%, 25%)
- Configurable exit triggers: price target, time-based, trailing stop
- Anti-detection: randomized sell sizes and timing
- Final exit: sells remaining position
- Uses `ProfitConsolidator` from trading engine

#### 8. Narrative Agent (`narrative-agent.ts`)
- AI-powered agent (uses OpenRouter/Groq/etc.)
- Generates token narratives and story arcs
- Analyzes market sentiment for the token
- Provides trading signals based on narrative analysis
- Integrates with intelligence layer (`StrategyBrain`, `SentimentAnalyzer`)

#### 9. Scanner Agent (`scanner-agent.ts`)
- Monitors Pump.fun for new launches
- Evaluates tokens against criteria (name, description, initial liquidity, creator history)
- Scores opportunities (0-100)
- Emits `scan:opportunity` events for other agents
- Tracks scanner accuracy over time

#### 10. Sentinel Agent (`sentinel-agent.ts`)
- Risk monitoring and circuit breaker
- Watches: max loss threshold, abnormal price drops, on-chain anomalies
- Triggers emergency exit if loss exceeds `EmergencyExitConfig.maxLossPercent`
- Monitors agent health (heartbeat checks)
- Emits alerts and risk events
- Can force-pause the swarm

### For Each Agent, Ensure:

1. **Real Solana transactions** — Use `@solana/web3.js` `Connection`, `Transaction`, `sendAndConfirmTransaction` or Jito bundles
2. **Proper error handling** — Catch `SendTransactionError`, handle slippage failures, handle insufficient balance
3. **Rate limiting** — Don't spam RPC endpoints
4. **Logging** — Use the Logger from `src/infra/` with structured context (agentId, role, action)
5. **Metrics** — Track trades, errors, latency via Metrics from `src/infra/`
6. **Anti-detection** — Randomized timing, varied transaction patterns (see `src/bundle/anti-detection.ts`)

## Files to Complete

- `packages/pump-agent-swarm/src/agents/creator-agent.ts`
- `packages/pump-agent-swarm/src/agents/trader-agent.ts`
- `packages/pump-agent-swarm/src/agents/sniper-agent.ts`
- `packages/pump-agent-swarm/src/agents/market-maker-agent.ts`
- `packages/pump-agent-swarm/src/agents/volume-agent.ts`
- `packages/pump-agent-swarm/src/agents/accumulator-agent.ts`
- `packages/pump-agent-swarm/src/agents/exit-agent.ts`
- `packages/pump-agent-swarm/src/agents/narrative-agent.ts`
- `packages/pump-agent-swarm/src/agents/scanner-agent.ts`
- `packages/pump-agent-swarm/src/agents/sentinel-agent.ts`
- `packages/pump-agent-swarm/src/agents/index.ts`

## Verification

1. `npm run typecheck` passes with all agents
2. Each agent can be instantiated without crashing
3. Each agent's `start()` and `stop()` methods work
4. Events are properly emitted to the EventBus
5. No `any` types, no `@ts-ignore`
