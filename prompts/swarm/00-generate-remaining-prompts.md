# Meta-Prompt: Generate Remaining Swarm Prompts (40–72)

## Agent Identity & Rules

```
You are a PROMPT-GENERATOR agent.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- Create exactly 33 markdown files in /workspaces/crypto-vision/prompts/swarm/
- Each file MUST follow the exact template format shown below
- Commit message: "feat(swarm): add prompts 40-72 for intelligence, coordination, dashboard, and demo phases"
```

## Objective

Create prompts 40 through 72 in `prompts/swarm/`. These are the remaining 33 prompts of a 72-prompt architecture for an autonomous memecoin agent swarm built on Pump.fun/Solana. Prompts 01–39 already exist. Each prompt instructs a separate AI coding agent to build one specific TypeScript file in `packages/pump-agent-swarm/src/`.

## How Prompts Already Created Work

Every prompt follows this exact structure. Here is a **real example** (prompt 30):

```markdown
# Prompt 30 — Bundle Coordinator

## Agent Identity & Rules

\```
You are the BUNDLE-COORDINATOR builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real Solana transactions, real bundle execution
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add bundle coordinator for multi-wallet atomic token acquisition"
\```

## Objective

Create `packages/pump-agent-swarm/src/bundle/bundle-coordinator.ts` — [one sentence describing what this file does].

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/bundle/bundle-coordinator.ts`

## Dependencies

- [list imports this file needs from other files in the project]

## Deliverables

### Create `packages/pump-agent-swarm/src/bundle/bundle-coordinator.ts`

1. **`ClassName` class**:
   - `constructor(...)` 
   - `method1(): ReturnType` — description
   - `method2(): ReturnType` — description
   [full API surface]

2. **TypeName interface/type**:
   \```typescript
   interface TypeName {
     field1: string;
     field2: number;
     // ... full type definition with comments
   }
   \```

3. **Core logic description** — paragraph explaining the algorithm/behavior

4. **More interfaces** with full TypeScript definitions

5. **Edge cases and error handling** details

### Success Criteria

- [3-6 bullet points defining what "done" means]
- Compiles with `npx tsc --noEmit`
```

## Key Rules for Each Prompt

1. **One file per prompt** — each prompt creates exactly ONE `.ts` file
2. **Full API surface** — list every public method with signature and description
3. **Full type definitions** — include complete TypeScript interfaces with field comments, not just names
4. **Real implementations expected** — specify real APIs, real endpoints, real math, real algorithms. No mocks, no stubs, no placeholder data
5. **Dependencies section** — list which other files from the project this file imports from
6. **Commit message** — provide a specific `feat(swarm): ...` commit message
7. **Success criteria** — 3-6 measurable criteria including `npx tsc --noEmit`

## The 33 Prompts to Create

Below is the spec for each. Create one `.md` file per prompt in `prompts/swarm/`.

---

### Phase 5 — Intelligence Layer (40-49)

All files go in `packages/pump-agent-swarm/src/intelligence/`

#### 40-strategy-brain.md → `intelligence/strategy-brain.ts`
**The AI decision engine.** This is the brain of the swarm. It decides:
- **Create a new token** vs **buy into an existing one** — based on market conditions, available capital, current opportunities
- **Which strategy to use** — ORGANIC, VOLUME, GRADUATION, EXIT, or a custom blend
- **When to switch phases** — from accumulation to market-making to exit
- Uses LLM calls (OpenRouter API: `https://openrouter.ai/api/v1/chat/completions`) for complex strategic reasoning with structured JSON output
- Uses on-chain data (bonding curve state, holder counts, volume) for tactical decisions
- `StrategyBrain` class with methods: `decideAction(context: MarketContext): Promise<StrategyDecision>`, `evaluateToken(mint: string): Promise<TokenAssessment>`, `shouldLaunch(narrative: string): Promise<LaunchDecision>`, `shouldBuyExisting(mint: string): Promise<BuyDecision>`, `selectStrategy(phase: string, metrics: SwarmMetrics): TradingStrategy`, `adjustStrategy(currentStrategy: TradingStrategy, performance: PerformanceMetrics): TradingStrategy`
- Types: `MarketContext` (SOL price, volume, trending narratives, fear/greed), `StrategyDecision` (action + reasoning + confidence), `TokenAssessment` (score 0-100 across multiple factors), `LaunchDecision`, `BuyDecision`
- Must call real OpenRouter API with model `google/gemini-2.0-flash-001` for strategic decisions
- Include system prompt engineering for crypto-native reasoning

#### 41-signal-generator.md → `intelligence/signal-generator.ts`
**On-chain signal generation.** Generates buy/sell signals from bonding curve data:
- `SignalGenerator` class
- Read bonding curve state at intervals, compute signals:
  - **Momentum**: rate of change in virtual SOL reserves (are people buying or selling?)
  - **Volume acceleration**: is trading volume increasing or decreasing?
  - **Price velocity**: how fast is price moving and in which direction?
  - **Holder flow**: net new holders vs departing holders
  - **Whale detection**: any single wallet buying/selling large amounts
  - **RSI-like indicator**: adapted for bonding curves (relative strength of buys vs sells over N trades)
- `generateSignals(mint: string): Promise<TradingSignals>` — returns aggregate signal with individual components
- `TradingSignals` type with `overall: 'strong-buy' | 'buy' | 'neutral' | 'sell' | 'strong-sell'`, plus individual indicator scores
- All signals computed from real on-chain data via `Connection.getAccountInfo()` on the bonding curve account
- Include signal history tracking for trend analysis

#### 42-risk-manager.md → `intelligence/risk-manager.ts`
**Portfolio risk management.** Prevents the swarm from taking excessive risk:
- `RiskManager` class
- Enforces: max position size per token, max total capital deployed, stop-loss thresholds, maximum drawdown limits, maximum number of simultaneous tokens
- `assessRisk(proposedAction: TradeAction): RiskAssessment` — approve/reject/modify a proposed trade
- `enforceStopLoss(positions: Position[]): StopLossAction[]` — check all positions against stop-loss
- `calculatePositionSize(budget: number, risk: number, conviction: number): number` — Kelly criterion-inspired sizing
- `getPortfolioRisk(): PortfolioRiskReport` — aggregate risk across all positions
- Types: `RiskAssessment` (approved/rejected/modified + reasoning), `RiskLimits` (configurable thresholds), `PortfolioRiskReport`, `DrawdownTracker`
- Track max drawdown from peak portfolio value
- Circuit breaker: if portfolio drops more than X% in Y minutes, halt all trading

#### 43-sentiment-analyzer.md → `intelligence/sentiment-analyzer.ts`
**Social sentiment analysis.** Analyze social media sentiment around tokens and narratives:
- `SentimentAnalyzer` class
- Real API integrations:
  - **Twitter/X**: Use `https://api.twitter.com/2/tweets/search/recent` (or fallback: scrape via `https://syndication.twitter.com`)
  - **Pump.fun comments**: Fetch from `https://frontend-api-v3.pump.fun/replies/{mint}`
  - **Google Trends**: Use unofficial API `https://trends.google.com/trends/api/dailytrends`
- Methods: `analyzeSentiment(query: string): Promise<SentimentReport>`, `getTokenSentiment(mint: string, name: string): Promise<TokenSentiment>`, `getTrendingNarratives(): Promise<TrendingNarrative[]>`, `scoreSentiment(texts: string[]): SentimentScore`
- Simple keyword-based + AI-powered sentiment scoring (send batch to OpenRouter for classification)
- Types: `SentimentReport` (score -1 to 1, volume, trending, sources), `TokenSentiment`, `TrendingNarrative`

#### 44-trend-detector.md → `intelligence/trend-detector.ts`
**Market trend detection.** Identify optimal launch timing and trending themes:
- `TrendDetector` class
- Monitor Pump.fun for patterns:
  - Fetch recent launches from `https://frontend-api-v3.pump.fun/coins?sort=created_timestamp&order=desc`
  - Track graduation rate (what % of recent launches graduate to PumpSwap)
  - Detect trending categories (AI coins, animal coins, political coins, etc.)
  - Identify peak activity hours
- Methods: `detectTrends(): Promise<MarketTrends>`, `isGoodTimeToLaunch(): Promise<LaunchTimingAssessment>`, `getTrendingCategories(): Promise<CategoryTrend[]>`, `getMarketActivity(): Promise<ActivityMetrics>`
- Types: `MarketTrends`, `LaunchTimingAssessment` (score 0-100 + factors), `CategoryTrend` (category + volume + momentum), `ActivityMetrics`
- Use real Pump.fun API endpoints, with caching (5-minute TTL)

#### 45-token-evaluator.md → `intelligence/token-evaluator.ts`
**Deep token evaluation.** Multi-criteria scoring for deciding whether to buy an existing token:
- `TokenEvaluator` class
- Evaluation criteria (each scored 0-100):
  - **Bonding curve health**: reserves ratio, distance to graduation, price stability
  - **Holder quality**: number of holders, distribution (Gini), top holder concentration
  - **Volume authenticity**: trade count vs unique wallets, buy/sell ratio, average trade size patterns
  - **Narrative strength**: name quality, description, social presence, meme potential
  - **Rug risk**: dev wallet activity, large holder movements, liquidity traps
  - **Age factor**: how old is the token, early momentum vs stale
- Methods: `evaluateToken(mint: string): Promise<TokenEvaluation>`, `quickScore(mint: string): Promise<number>`, `compareTokens(mints: string[]): Promise<TokenComparison>`
- `TokenEvaluation` type with per-criteria scores, weighted overall score, confidence, and recommendation ('strong-buy' | 'buy' | 'hold' | 'avoid')
- Read on-chain data: bonding curve account, token holder list, recent transactions
- Use Pump.fun API for metadata: `https://frontend-api-v3.pump.fun/coins/{mint}`

#### 46-market-regime.md → `intelligence/market-regime.ts`
**Market regime classification.** Classify current market conditions:
- `MarketRegime` class
- Regimes: `bull` | `bear` | `crab` | `euphoria` | `capitulation`
- Data sources for classification:
  - SOL price trend (via Jupiter: `https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112`)
  - Pump.fun new launches per hour (API scrape)
  - Fear & Greed Index (via `https://api.alternative.me/fng/`)
  - DeFi TVL trend (via DeFiLlama: `https://api.llama.fi/v2/historicalChainTvl/Solana`)
  - Memecoin index (aggregate Pump.fun graduation rate)
- Methods: `classifyRegime(): Promise<RegimeClassification>`, `getRegimeHistory(): RegimeEntry[]`, `adjustStrategyForRegime(strategy: TradingStrategy, regime: RegimeClassification): TradingStrategy`
- Each regime maps to strategy adjustments (e.g., bull → more aggressive, bear → conservative/exit)

#### 47-alpha-scanner.md → `intelligence/alpha-scanner.ts`
**Alpha opportunity scanner.** Continuous scanner for alpha on Pump.fun:
- `AlphaScanner` class
- Scans for:
  - New tokens with high early volume but low holder count (early opportunities)
  - Tokens approaching graduation threshold (~85 SOL in curve)
  - Tokens with narratives matching trending categories
  - Tokens where dev hasn't sold (committed dev = bullish signal)
  - Tokens with organic-looking holder distribution
- Methods: `scan(): Promise<AlphaOpportunity[]>`, `startContinuousScan(intervalMs: number): void`, `stopScan(): void`, `getTopOpportunities(limit: number): AlphaOpportunity[]`, `subscribeToOpportunities(callback: (opp: AlphaOpportunity) => void): () => void`
- `AlphaOpportunity` type: mint, name, score, category (graduation-play, early-entry, narrative-match), reasoning, urgency ('immediate' | 'soon' | 'watch'), estimated upside
- Use real Pump.fun API: `https://frontend-api-v3.pump.fun/coins?sort=market_cap&order=desc&limit=50&offset=0`

#### 48-narrative-generator.md → `intelligence/narrative-generator.ts`
**Advanced narrative generation.** Beyond the basic narrative agent — this generates multiple narrative options, A/B tests them, and aligns with trends:
- `NarrativeGenerator` class
- Methods: `generateNarratives(count: number, constraints?: NarrativeConstraints): Promise<TokenNarrative[]>`, `rankNarratives(narratives: TokenNarrative[]): Promise<RankedNarrative[]>`, `alignWithTrends(narrative: TokenNarrative, trends: MarketTrends): Promise<TokenNarrative>`, `generateImage(narrative: TokenNarrative): Promise<Buffer>` (via DALL-E or Stability API)
- `NarrativeConstraints`: target category, avoid categories, must-include keywords, tone (funny/serious/edgy), max name length
- `RankedNarrative`: narrative + predicted virality score + reasoning
- Uses OpenRouter LLM for creative generation with specialized system prompts
- Image generation: use `https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image` or OpenAI `https://api.openai.com/v1/images/generations`
- Include narrative history tracking to avoid repetition

#### 49-portfolio-optimizer.md → `intelligence/portfolio-optimizer.ts`
**Multi-token portfolio optimization.** If operating across multiple tokens simultaneously:
- `PortfolioOptimizer` class
- Methods: `optimize(holdings: TokenHolding[], budget: number): PortfolioAllocation`, `rebalance(current: PortfolioState, target: PortfolioAllocation): RebalanceActions[]`, `calculateCorrelation(token1: string, token2: string): number`, `getEfficientFrontier(tokens: string[]): EfficientFrontierPoint[]`
- Adaptation of Modern Portfolio Theory for memecoins:
  - Covariance estimation from price history (short window, bonding curve prices)
  - Risk-return optimization with configurable risk tolerance
  - Constraint: max N% in any single token, min M tokens for diversification
- Types: `PortfolioAllocation` (map of mint → weight), `RebalanceActions` (buy/sell instructions), `PortfolioState`, `EfficientFrontierPoint`
- Include max Sharpe ratio calculation adapted for bonding curve returns

---

### Phase 6 — Coordination Layer (50-59)

All files go in `packages/pump-agent-swarm/src/coordination/`

#### 50-swarm-orchestrator.md → `coordination/swarm-orchestrator.ts`
**THE MAIN BRAIN — complete rewrite of swarm.ts using all new infrastructure.**
- `SwarmOrchestrator` class (replaces old `SwarmCoordinator`)
- This is the central orchestrator that wires everything together:
  - Creates and manages all agent instances (Narrative, Scanner, Creator, Trader pool, Market Maker, Volume, Accumulator, Exit, Sentinel)
  - Uses `SwarmStateMachine` for lifecycle (from `infra/state-machine.ts`)
  - Uses `SwarmEventBus` for all inter-agent communication (from `infra/event-bus.ts`)
  - Uses `WalletVault` for all wallet operations (from `infra/wallet-vault.ts` or `wallet-manager.ts`)
  - Uses `RPCConnectionPool` for all RPC calls (from `infra/rpc-pool.ts`)
  - Uses `StrategyBrain` for high-level decisions (from `intelligence/strategy-brain.ts`)
  - Uses `LaunchSequencer` for token launches (from `bundle/launch-sequencer.ts`)
  - Uses `WashEngine` for coordinated trading (from `trading/wash-engine.ts`)
  - Uses `RiskManager` for risk enforcement (from `intelligence/risk-manager.ts`)
  - Uses `AuditLogger` for recording all actions (from `coordination/audit-logger.ts`)
- Methods: `initialize(): Promise<void>`, `start(): Promise<void>`, `stop(): Promise<void>`, `getStatus(): SwarmStatus`, `executeStrategy(decision: StrategyDecision): Promise<void>`, `handleEvent(event: SwarmEvent): Promise<void>`
- Full lifecycle: INIT → PLANNING → LAUNCHING → TRADING → MONITORING → EXITING → CLEANUP
- Event-driven: all inter-agent coordination through event bus, never direct method calls between agents
- This is the biggest, most complex prompt — allocate 500+ lines of implementation guidance

#### 51-agent-messenger.md → `coordination/agent-messenger.ts`
**Agent-to-Agent messaging using A2A protocol from `packages/agent-runtime/`.**
- `AgentMessenger` class
- Uses JSON-RPC protocol for structured messages between agents
- Methods: `sendMessage(from: string, to: string, message: AgentMessage): Promise<MessageResponse>`, `broadcast(from: string, message: AgentMessage): Promise<void>`, `subscribe(agentId: string, handler: MessageHandler): () => void`, `getMessageHistory(agentId: string): AgentMessage[]`
- Message types: `TradeSignal`, `StrategyUpdate`, `RiskAlert`, `StatusReport`, `TaskAssignment`, `Acknowledgement`
- Priority levels: `critical` (risk alerts) > `high` (trade signals) > `normal` (status) > `low` (metrics)
- Message queue with ordered delivery per agent
- Links to `packages/agent-runtime/src/a2a/` types and protocols

#### 52-consensus-engine.md → `coordination/consensus-engine.ts`
**Multi-agent consensus for group decisions.**
- `ConsensusEngine` class
- When multiple agents have conflicting views (e.g., SignalGenerator says buy, RiskManager says sell), reach consensus
- Methods: `proposeAction(action: ProposedAction, voters: string[]): Promise<ConsensusResult>`, `vote(proposalId: string, agentId: string, vote: AgentVote): void`, `resolveProposal(proposalId: string): ConsensusResult`
- Voting strategies: `majority` (>50%), `supermajority` (>66%), `weighted` (agents with better track records get more weight), `dictator` (RiskManager always wins on risk issues)
- Types: `ProposedAction`, `AgentVote` (approve/reject/abstain + reasoning + confidence), `ConsensusResult` (approved/rejected + vote breakdown)
- Timeout: if not all votes received within N seconds, decide with votes available
- Track voting history for weight calibration

#### 53-task-delegator.md → `coordination/task-delegator.ts`
**Task delegation system.**
- `TaskDelegator` class
- Methods: `createTask(task: SwarmTask): string`, `assignTask(taskId: string, agentId: string): void`, `completeTask(taskId: string, result: TaskResult): void`, `failTask(taskId: string, error: string): void`, `getTasks(filter?: TaskFilter): SwarmTask[]`, `getAgentTasks(agentId: string): SwarmTask[]`
- Task types: `launch-token`, `buy-supply`, `start-trading`, `monitor-curve`, `generate-narrative`, `scan-opportunities`, `execute-exit`
- Task states: `created` → `assigned` → `in-progress` → `completed` | `failed` | `cancelled`
- Priority queue: higher priority tasks assigned first
- Agent capacity: each agent has a max concurrent task limit
- Dependencies: tasks can depend on other tasks (don't start trading until launch completes)

#### 54-lifecycle-manager.md → `coordination/lifecycle-manager.ts`
**Agent lifecycle management.**
- `LifecycleManager` class
- Manages: agent spawning, heartbeat monitoring, failure detection, automatic restart
- Methods: `spawnAgent(type: AgentType, config: AgentConfig): Promise<AgentInstance>`, `killAgent(agentId: string): Promise<void>`, `restartAgent(agentId: string): Promise<AgentInstance>`, `getAgentStatus(agentId: string): AgentStatus`, `getAllAgents(): AgentInstance[]`, `monitorHeartbeats(): void`
- Heartbeat: each agent emits heartbeat every N seconds via event bus. If missed for M seconds, mark as unhealthy. After P seconds with no heartbeat, attempt restart.
- Graceful shutdown: signal agent to finish current operation, wait up to timeout, then force kill
- Types: `AgentInstance` (id, type, status, lastHeartbeat, startedAt, restartCount), `AgentStatus` ('healthy' | 'degraded' | 'unresponsive' | 'dead')

#### 55-health-monitor.md → `coordination/health-monitor.ts`
**Aggregate swarm health monitoring.**
- `HealthMonitor` class
- Aggregates health from all agents, wallets, RPC connections, and external dependencies
- Methods: `getHealthReport(): Promise<HealthReport>`, `isHealthy(): boolean`, `startMonitoring(intervalMs: number): void`, `stopMonitoring(): void`, `onHealthChange(callback: (report: HealthReport) => void): () => void`
- Check: agent heartbeats, RPC pool availability, wallet balances (any wallet running low?), event bus backlog, memory/CPU usage
- `HealthReport` type: overall status ('healthy' | 'degraded' | 'critical'), per-component status, uptime, last check timestamp, issues list
- Emit `health:degraded` or `health:critical` events via event bus for automated responses

#### 56-phase-controller.md → `coordination/phase-controller.ts`
**Phase transition controller.**
- `PhaseController` class
- Manages transitions between swarm operational phases based on multi-agent state
- Phases: `idle` → `scouting` → `preparing` → `launching` → `accumulating` → `trading` → `monitoring` → `exiting` → `cleanup`
- Methods: `getCurrentPhase(): SwarmPhase`, `canTransition(to: SwarmPhase): boolean`, `transition(to: SwarmPhase): Promise<void>`, `getPhaseRequirements(phase: SwarmPhase): PhaseRequirements`, `onPhaseChange(callback: (from: SwarmPhase, to: SwarmPhase) => void): () => void`
- Each phase has entry conditions (e.g., can't start trading unless token is created and wallets are funded)
- Each phase has exit conditions (e.g., exit trading when target P&L hit or max duration reached)
- Phase timers: max duration per phase, auto-transition on timeout

#### 57-rollback-manager.md → `coordination/rollback-manager.ts`
**State rollback capabilities.**
- `RollbackManager` class
- Takes snapshots of swarm state before risky operations, can restore on failure
- Methods: `createSnapshot(label: string): string`, `rollback(snapshotId: string): Promise<void>`, `getSnapshots(): Snapshot[]`, `deleteSnapshot(snapshotId: string): void`, `autoSnapshot(phase: SwarmPhase): string`
- Snapshot includes: agent states, wallet balances (cached), strategy parameters, phase, open positions
- Note: on-chain state cannot be rolled back (transactions are final). Rollback restores the *orchestrator's internal state* so it can make correct decisions going forward
- Auto-snapshot before every phase transition

#### 58-audit-logger.md → `coordination/audit-logger.ts`
**Immutable audit trail.**
- `AuditLogger` class
- Logs every significant action for post-mortem analysis
- Methods: `logAction(entry: AuditEntry): void`, `logTrade(trade: TradeResult): void`, `logDecision(decision: StrategyDecision): void`, `logPhaseChange(from: string, to: string): void`, `logError(error: Error, context: Record<string, unknown>): void`, `getAuditTrail(filter?: AuditFilter): AuditEntry[]`, `exportAuditLog(): string` (JSON), `getTradeAudit(): TradeAuditSummary`
- Each entry has: timestamp, type, agentId, action, details, signature (if on-chain), success/failure
- Append-only in-memory log with max size (FIFO eviction of oldest entries)
- Types: `AuditEntry`, `AuditFilter` (by time range, agent, type), `TradeAuditSummary` (aggregate trade stats)
- Subscribe to relevant events on `SwarmEventBus` automatically

#### 59-swarm-config-manager.md → `coordination/swarm-config-manager.ts`
**Runtime configuration management.**
- `SwarmConfigManager` class
- Allows changing configuration at runtime without restart
- Methods: `getConfig(): SwarmConfig`, `updateConfig(patch: Partial<SwarmConfig>): void`, `resetToDefaults(): void`, `getConfigHistory(): ConfigChange[]`, `onConfigChange(callback: (change: ConfigChange) => void): () => void`, `validateConfig(config: Partial<SwarmConfig>): ValidationResult`
- Hot-reloadable settings: strategy parameters, risk limits, trading intervals, wallet rotation rules, agent count
- Non-hot-reloadable settings (require restart): RPC endpoints, master wallet
- Emit `config:changed` event on every change via event bus
- Validation: prevent dangerous configs (e.g., stop-loss at 0%, budget = $1M)

---

### Phase 7 — Dashboard (60-69)

All files go in `packages/pump-agent-swarm/src/dashboard/`

#### 60-dashboard-server.md → `dashboard/server.ts`
**Hono-based HTTP server for the live dashboard.**
- Import `Hono` from `hono`
- Serves REST API at `/api/...` and WebSocket at `/ws`
- Methods: `createDashboardServer(orchestrator: SwarmOrchestrator): Hono`, `startDashboard(port: number): void`
- Routes: GET `/api/status`, `/api/agents`, `/api/trades`, `/api/pnl`, `/api/config`, `/api/health`, `/api/events`
- CORS enabled for all origins (demo mode)
- Include basic HTML page at GET `/` with embedded JavaScript that connects to WebSocket and displays real-time data (single-file dashboard, no framework needed — vanilla JS with inline CSS)

#### 61-websocket.md → `dashboard/websocket.ts`
**Real-time WebSocket updates.**
- `DashboardWebSocket` class
- Methods: `broadcast(event: DashboardEvent): void`, `getConnectedClients(): number`, `start(server: unknown): void`, `stop(): void`
- Subscribe to `SwarmEventBus` and forward relevant events to all connected WebSocket clients
- Event types pushed: `trade:executed`, `agent:status`, `pnl:updated`, `phase:changed`, `health:report`, `signal:generated`
- Heartbeat ping/pong to detect stale connections
- Use `hono/ws` or raw `ws` package for WebSocket support

#### 62-api-routes.md → `dashboard/api-routes.ts`
**REST API routes for dashboard data.**
- Export a function that registers routes on a Hono app
- Routes: 
  - GET `/api/status` — overall swarm status, current phase, uptime
  - GET `/api/agents` — list all agents with status, P&L, trade count
  - GET `/api/agents/:id` — single agent detail
  - GET `/api/trades` — trade history with pagination (query: `?limit=50&offset=0`)
  - GET `/api/trades/flow` — agent-to-agent trade flow data (for visualization)
  - GET `/api/pnl` — portfolio P&L time series
  - GET `/api/pnl/agents` — per-agent P&L breakdown
  - GET `/api/supply` — token supply distribution across wallets
  - GET `/api/config` — current swarm config
  - PUT `/api/config` — update config (via SwarmConfigManager)
  - GET `/api/health` — health report
  - GET `/api/events` — recent events
  - GET `/api/audit` — audit trail
  - POST `/api/actions/pause` — pause trading
  - POST `/api/actions/resume` — resume trading
  - POST `/api/actions/exit` — trigger exit strategy

#### 63-trade-visualizer.md → `dashboard/trade-visualizer.ts`
**Trade flow visualization data.**
- `TradeVisualizer` class
- Formats trade data for visualization (Sankey diagrams, flow charts)
- Methods: `getTradeFlow(timeRange?: TimeRange): TradeFlowData`, `getAgentInteractions(): AgentInteractionMatrix`, `getTradeTimeline(limit: number): TradeTimelineEntry[]`, `getPriceChart(): PriceChartData`
- `TradeFlowData`: nodes (agents) + links (trades between them) with values (SOL volume)
- `AgentInteractionMatrix`: NxN matrix of which agent traded how much with which
- `PriceChartData`: time series of bonding curve price with trade markers

#### 64-agent-monitor.md → `dashboard/agent-monitor.ts`
**Per-agent monitoring data.**
- `AgentMonitor` class
- Methods: `getAgentDetails(id: string): AgentDetail`, `getAllAgents(): AgentSummary[]`, `getAgentHistory(id: string): AgentHistoryEntry[]`
- `AgentDetail`: id, type, status, wallet address, SOL balance, token balance, P&L, trade count, last action, uptime, error count, current task
- Track agent performance over time for dashboard charts

#### 65-pnl-dashboard.md → `dashboard/pnl-dashboard.ts`
**P&L chart data formatting.**
- `PnLDashboard` class
- Methods: `getAggregatePnL(): PnLTimeSeries`, `getPerAgentPnL(): Map<string, PnLTimeSeries>`, `getRealized(): number`, `getUnrealized(): number`, `getCurrentROI(): number`
- `PnLTimeSeries`: array of `{ timestamp: number, realized: number, unrealized: number, total: number }`
- Sample at configurable intervals (default 10s)
- Include cumulative and per-period (delta) views

#### 66-supply-chart.md → `dashboard/supply-chart.ts`
**Token supply distribution data.**
- `SupplyChart` class
- Methods: `getDistribution(mint: string): Promise<SupplyDistribution>`, `getDistributionHistory(): SupplyDistribution[]`
- `SupplyDistribution`: array of `{ wallet: string, label: string, tokens: bigint, percent: number, role: string }`
- Separate swarm wallets from external holders
- Provide data suitable for pie chart rendering

#### 67-event-timeline.md → `dashboard/event-timeline.ts`
**Chronological event stream.**
- `EventTimeline` class
- Methods: `getEvents(filter?: EventFilter): TimelineEvent[]`, `getRecentEvents(limit: number): TimelineEvent[]`, `subscribe(callback: (event: TimelineEvent) => void): () => void`
- `TimelineEvent`: timestamp, category ('trade' | 'agent' | 'phase' | 'risk' | 'system'), severity ('info' | 'warning' | 'error' | 'critical'), title, description, agentId?, signature?
- Subscribes to SwarmEventBus and creates timeline entries from events
- In-memory circular buffer (max 10,000 events)

#### 68-alert-manager.md → `dashboard/alert-manager.ts`
**Alert management for dashboard.**
- `AlertManager` class
- Methods: `createAlert(alert: Alert): string`, `acknowledgeAlert(id: string): void`, `getActiveAlerts(): Alert[]`, `getAlertHistory(): Alert[]`, `configureThreshold(metric: string, threshold: number): void`
- Auto-generated alerts from: risk events, health degradation, P&L thresholds, agent failures, unusual trading patterns
- Alert levels: `info`, `warning`, `critical`
- Alerts include: id, level, message, timestamp, acknowledged, auto-resolve conditions

#### 69-export-manager.md → `dashboard/export-manager.ts`
**Session data export.**
- `ExportManager` class
- Methods: `exportSession(): SessionExport`, `exportTrades(): string` (CSV), `exportAudit(): string` (JSON), `exportPnL(): string` (CSV), `exportFullReport(): string` (Markdown)
- `SessionExport`: JSON blob with all trades, events, config, P&L, agent metrics, audit trail
- Used for post-mortem analysis after a swarm session
- Include markdown report generation with summary statistics

---

### Phase 8 — Demo & Polish (70-72)

All files go in `packages/pump-agent-swarm/src/demo/`

#### 70-cli-runner.md → `demo/cli-runner.ts`
**CLI command for launching the full swarm.**
- `SwarmCLI` class + `main()` function
- Interactive prompts (`readline` interface) for:
  - Network selection (mainnet / devnet)
  - Strategy selection (create new / buy existing / auto)
  - Budget (SOL amount)
  - Number of trader agents
  - Confirm before proceeding
- Real-time terminal output: colored logs showing each agent's actions
- Signal handling: SIGINT/SIGTERM trigger graceful shutdown
- Show running P&L, trade count, phase, agent status in compact terminal display
- Uses all other components: orchestrator, strategies, agents
- Entry point: `npx tsx packages/pump-agent-swarm/src/demo/cli-runner.ts`

#### 71-demo-mode.md → `demo/demo-mode.ts`
**Demo mode for hackathon presentation.**
- `DemoMode` class
- Uses **devnet** SOL (request from faucet: `https://api.devnet.solana.com` with `requestAirdrop`)
- Guided walkthrough with step-by-step narration printed to console
- Steps: (1) Generate wallet pool, (2) Fund from faucet, (3) Decide strategy via AI, (4) Generate narrative, (5) Create token, (6) Bundle buy, (7) Start trading, (8) Show P&L, (9) Exit
- Each step pauses for dramatic effect (configurable delay)
- Outputs a summary report at the end
- Safe for demo: limited budget, devnet only, auto-stops after N minutes
- Methods: `runDemo(config?: DemoConfig): Promise<DemoResult>`

#### 72-presentation.md → `demo/presentation.ts`
**Presentation mode with AI narration.**
- `PresentationMode` class
- Everything from DemoMode PLUS:
  - AI-generated commentary on what's happening (via OpenRouter)
  - Formatted output for screen sharing / projector
  - Key metrics highlighted with ASCII art / box-drawing characters
  - Timestamp each action for the judges
  - Generate a post-demo summary with highlights
- Methods: `runPresentation(config?: PresentationConfig): Promise<void>`
- Narration: after each major event, call OpenRouter to generate a 1-2 sentence explanation of what just happened and why it matters
- Update `packages/pump-agent-swarm/src/examples/run-swarm.ts` to import and use SwarmCLI as an entry point

---

## Execution Instructions

1. **Create all 33 files** sequentially: `40-strategy-brain.md`, `41-signal-generator.md`, ..., `72-presentation.md`
2. Each file must follow the **exact template** shown above (Agent Identity & Rules → Objective → File Ownership → Dependencies → Deliverables → Success Criteria)
3. Each prompt must have **full TypeScript interface definitions** inline (don't just say "define a type" — show the actual interface with all fields and types)
4. Each prompt must specify a **unique commit message** starting with `feat(swarm):`
5. After creating all files, run: `ls -la prompts/swarm/ | wc -l` — should show 73 entries (72 prompts + README)
6. Commit all prompts: `git add prompts/swarm/ && git commit -m "feat(swarm): add prompts 40-72 for intelligence, coordination, dashboard, and demo"` then push

## Success Criteria

- All 33 files created in `prompts/swarm/`
- Every file follows the exact template format
- Every file specifies complete TypeScript interfaces (not abbreviated)
- Every file maps to exactly one `.ts` file in the file ownership map
- No duplicate file ownership across prompts
- Compiles as valid markdown (no broken code blocks)
