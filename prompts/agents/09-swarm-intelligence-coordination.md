# Prompt 09 — Pump Agent Swarm: Intelligence Layer & Coordination

## Context

You are working on `packages/pump-agent-swarm/` in the crypto-vision monorepo. The intelligence layer (`src/intelligence/`) provides AI-driven decision making, and the coordination layer (`src/coordination/`) orchestrates the swarm's lifecycle.

## Intelligence Files (`src/intelligence/`)

| File | Purpose |
|------|---------|
| `strategy-brain.ts` | Central decision maker — when to buy/sell/hold/exit |
| `signal-generator.ts` | Generates trading signals from multiple data sources |
| `risk-manager.ts` | Risk assessment and position sizing |
| `sentiment-analyzer.ts` | Analyzes market sentiment from social/on-chain data |
| `trend-detector.ts` | Detects price trends and momentum |
| `token-evaluator.ts` | Evaluates new tokens for opportunity scoring |
| `market-regime.ts` | Classifies market regime (bull/bear/sideways/volatile) |
| `alpha-scanner.ts` | Scans for alpha opportunities across Pump.fun |
| `narrative-generator.ts` | AI-generated token narratives and story arcs |
| `portfolio-optimizer.ts` | Optimizes allocation across tokens |

## Coordination Files (`src/coordination/`)

| File | Purpose |
|------|---------|
| `swarm-coordinator.ts` | Extended SwarmCoordinator with full lifecycle |
| `agent-messenger.ts` | Inter-agent communication via EventBus |
| `consensus-engine.ts` | Multi-agent consensus for trade decisions |
| `task-delegator.ts` | Assigns tasks to agents based on role/availability |
| `lifecycle-manager.ts` | Agent lifecycle: spawn, monitor, restart, shutdown |
| `health-monitor.ts` | Agent health checks and heartbeat monitoring |
| `phase-controller.ts` | State machine for swarm phases (18 states) |
| `rollback-manager.ts` | Handles failed operations and rollback |
| `audit-logger.ts` | Comprehensive audit trail for all actions |
| `config-manager.ts` | Dynamic configuration management |

## Task

### 1. Complete the Strategy Brain

The Strategy Brain is the AI core that makes trading decisions:

```typescript
// StrategyBrain should:
// 1. Accept market data: current price, volume, bonding curve state, holder data
// 2. Accept signals from SignalGenerator
// 3. Accept risk assessment from RiskManager
// 4. Accept sentiment from SentimentAnalyzer
// 5. Output decisions:
//    - Should we buy? How much? Which agent?
//    - Should we sell? How much? Which agent?
//    - Should we hold? For how long?
//    - Should we exit? Graceful or emergency?
//    - Should we adjust strategy? Which parameters?
// 6. Use a weighted scoring model:
//    - Momentum score (0-100)
//    - Sentiment score (0-100)
//    - Risk score (0-100, inverted — lower = more risk)
//    - Volume health score (0-100)
//    - Final decision = weighted average against thresholds
// 7. Optionally call AI (OpenRouter/Groq) for complex analysis
// 8. Log every decision with reasoning for audit trail
```

### 2. Complete the Signal Generator

```typescript
// SignalGenerator should:
// 1. Consume real-time price data from bonding curve
// 2. Calculate technical indicators:
//    - RSI (14-period relative strength index)
//    - MACD (12, 26, 9)
//    - Bollinger Bands (20-period, 2 std dev)
//    - Volume-weighted average price (VWAP)
//    - On-balance volume (OBV)
// 3. Generate signals: BUY, SELL, HOLD with confidence (0-1)
// 4. Combine multiple indicator signals
// 5. Track signal accuracy over time
// 6. Emit signals via EventBus for the StrategyBrain to consume
```

### 3. Complete the Risk Manager

```typescript
// RiskManager should:
// 1. Position sizing: Kelly Criterion or fixed-fraction
// 2. Maximum position limits per agent and total
// 3. Drawdown monitoring: current drawdown vs max allowed
// 4. Correlation risk: detect if all agents are taking the same side
// 5. Liquidity risk: warn if bonding curve reserves are thin
// 6. Concentration risk: warn if too much supply in few wallets
// 7. Time risk: enforce maximum duration limits
// 8. Emergency triggers: loss exceeds threshold → emit emergency event
// 9. Risk scoring: 0-100 per dimension, composite score
```

### 4. Complete the Consensus Engine

```typescript
// ConsensusEngine should:
// 1. Collect signals/votes from multiple agents
// 2. Weighted voting: agents with better track records get more weight
// 3. Consensus types:
//    - Majority: > 50% agree
//    - Supermajority: > 66% agree
//    - Unanimous: 100% agree
// 4. Timeout: if consensus not reached in N seconds, default to hold
// 5. Different consensus requirements per action:
//    - Buy: majority
//    - Sell: majority
//    - Exit: supermajority
//    - Emergency: any sentinel agent can trigger
// 6. Audit: log all votes and outcomes
```

### 5. Complete the Phase Controller

The swarm operates through 18 phases. Implement the state machine:

```
idle → initializing → funding → scanning → evaluating → creating_narrative
→ minting → bundling → distributing → trading → market_making → accumulating
→ graduating → exiting → reclaiming → completed

Any phase → paused (resume → previous phase)
Any phase → error (recover → previous phase)
Any phase → emergency_exit (forced shutdown)
```

```typescript
// PhaseController should:
// 1. Define valid transitions between phases
// 2. Before transition: validate preconditions (e.g., can't start trading without a token)
// 3. On transition: emit phase:changed event
// 4. After transition: trigger phase-specific initialization
// 5. Handle pause/resume with state preservation
// 6. Handle error recovery
// 7. Enforce emergency exit from any state
```

### 6. Complete the Lifecycle Manager

```typescript
// LifecycleManager should:
// 1. Spawn agents based on config (agentCounts per role)
// 2. Assign wallets from pool to agents
// 3. Monitor agent heartbeats (last activity timestamp)
// 4. Restart failed agents (max 3 retries)
// 5. Scale agents up/down based on performance
// 6. Graceful shutdown: stop all agents, wait for pending trades, reclaim funds
// 7. Report agent health to dashboard
```

### 7. Complete the Audit Logger

```typescript
// AuditLogger should:
// 1. Log every trade with: agent, direction, amount, price, tx signature, timestamp
// 2. Log every phase transition
// 3. Log every config change
// 4. Log every risk event
// 5. Log every agent lifecycle event (start, stop, error, restart)
// 6. Store in memory (circular buffer, 100K entries)
// 7. Export to JSON/CSV on demand
// 8. Queryable: filter by agent, time range, event type
```

### 8. AI Integration

For the narrative-generator and sentiment-analyzer, integrate with:
- OpenRouter API (`OPENROUTER_API_KEY`)
- Fallback: Groq API
- Model: use a fast, cheap model (e.g., `meta-llama/llama-3.1-8b-instruct`)
- Structured output: JSON response parsing with Zod validation
- Rate limiting: max 10 requests/minute
- Caching: cache identical queries for 5 minutes

## Technical Requirements

- All numeric calculations use BN.js for precision (no floating point for money)
- Technical indicators calculated manually (no TA-lib dependency)
- AI calls are optional and gracefully degrade if API key not set
- All modules use the EventBus for inter-module communication
- Structured logging with context (module name, agent ID)
- No `any` types
- All exports via barrel files

## Verification

1. `npm run typecheck` passes
2. StrategyBrain can make a decision given mock market data
3. SignalGenerator can calculate RSI and MACD from a price series
4. PhaseController correctly enforces valid state transitions
5. ConsensusEngine reaches consensus with mock agent votes
6. AuditLogger stores and queries events correctly
