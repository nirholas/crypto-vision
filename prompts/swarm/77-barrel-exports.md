# Prompt 77 — Master Barrel Exports

## Agent Identity & Rules

```
You are the BARREL-EXPORTS builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- Export every public class, interface, type, and function from each module
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add barrel exports for all modules with clean public API surface"
```

## Objective

Create `index.ts` barrel files for every subdirectory in `packages/pump-agent-swarm/src/` and update the root `src/index.ts` to re-export everything. This wires all 70+ modules into a coherent public API that can be imported with clean paths like `@crypto-vision/pump-agent-swarm/agents` or `@crypto-vision/pump-agent-swarm`.

## File Ownership

- **Modifies**: `packages/pump-agent-swarm/src/index.ts`
- **Creates**: `packages/pump-agent-swarm/src/infra/index.ts`
- **Creates**: `packages/pump-agent-swarm/src/agents/index.ts`
- **Creates**: `packages/pump-agent-swarm/src/trading/index.ts`
- **Creates**: `packages/pump-agent-swarm/src/bundle/index.ts`
- **Creates**: `packages/pump-agent-swarm/src/intelligence/index.ts`
- **Creates**: `packages/pump-agent-swarm/src/coordination/index.ts`
- **Creates**: `packages/pump-agent-swarm/src/dashboard/index.ts`
- **Creates**: `packages/pump-agent-swarm/src/telegram/index.ts` (if not created by P75)
- **Creates**: `packages/pump-agent-swarm/src/persistence/index.ts` (if not created by P74)
- **Creates**: `packages/pump-agent-swarm/src/demo/index.ts`

## Dependencies

- All source files created by prompts 01-75

## Deliverables

### Create `packages/pump-agent-swarm/src/infra/index.ts`

```typescript
export { RpcPool, type RpcPoolConfig, type RpcEndpoint, type RpcHealth } from './rpc-pool.js';
export { EventBus, type EventMap, type EventHandler } from './event-bus.js';
export { StateMachine, type StateConfig, type StateTransition, type SwarmPhase } from './state-machine.js';
export { SwarmLogger, type LogLevel, type LogEntry } from './logger.js';
export { MetricsCollector, type MetricType, type MetricSnapshot } from './metrics.js';
export { ErrorHandler, SwarmError, type ErrorContext, type ErrorSeverity } from './error-handler.js';
```

### Create `packages/pump-agent-swarm/src/agents/index.ts`

```typescript
export { NarrativeAgent, type TokenConcept, type NarrativeConfig } from './narrative-agent.js';
export { ScannerAgent, type ScanResult, type ScanFilter } from './scanner-agent.js';
export { CreatorAgent, type CreateResult, type TokenMetadata } from './creator-agent.js';
export { TraderAgent, type TradeResult, type TradeConfig } from './trader-agent.js';
export { SniperAgent, type SniperConfig, type SniperTarget } from './sniper-agent.js';
export { MarketMakerAgent, type MarketMakerConfig, type SpreadConfig } from './market-maker-agent.js';
export { VolumeAgent, type VolumeConfig, type VolumeSchedule } from './volume-agent.js';
export { AccumulatorAgent, type AccumulationConfig, type AccumulationTarget } from './accumulator-agent.js';
export { ExitAgent, type ExitConfig, type ExitStrategy } from './exit-agent.js';
export { SentinelAgent, type SentinelConfig, type ThreatLevel } from './sentinel-agent.js';
```

### Create `packages/pump-agent-swarm/src/trading/index.ts`

```typescript
export { WashEngine, type WashConfig, type WashPair } from './wash-engine.js';
export { VolumeGenerator, type VolumeProfile, type VolumeTarget } from './volume-generator.js';
export { PriceTrajectory, type PriceTarget, type TrajectoryConfig } from './price-trajectory.js';
export { WalletRotation, type RotationPolicy, type RotationEvent } from './wallet-rotation.js';
export { TradeScheduler, type ScheduleConfig, type ScheduledTrade } from './trade-scheduler.js';
export { OrderRouter, type Route, type RouterConfig } from './order-router.js';
export { SlippageCalculator, type SlippageEstimate, type SlippageConfig } from './slippage-calculator.js';
export { GasOptimizer, type GasEstimate, type FeeStrategy } from './gas-optimizer.js';
export { PositionManager, type Position, type PositionUpdate } from './position-manager.js';
export { PnLTracker, type PnLSnapshot, type PnLReport } from './pnl-tracker.js';
```

### Create `packages/pump-agent-swarm/src/bundle/index.ts`

```typescript
export { BundleCoordinator, type BundlePlan, type BundleResult } from './bundle-coordinator.js';
export { JitoClient, type JitoConfig, type BundleStatus } from './jito-client.js';
export { SupplyDistributor, type DistributionPlan, type DistributionResult } from './supply-distributor.js';
export { AntiDetection, type AntiDetectionConfig, type DetectionScore } from './anti-detection.js';
export { TimingEngine, type TimingConfig, type TimingWindow } from './timing-engine.js';
export { BundleValidator, type ValidationResult, type BundleCheck } from './bundle-validator.js';
export { LaunchSequencer, type LaunchConfig, type LaunchPhase } from './launch-sequencer.js';
export { DevBuyOptimizer, type DevBuyConfig, type DevBuyResult } from './dev-buy-optimizer.js';
export { WalletFunder, type FundingPlan, type FundingResult } from './wallet-funder.js';
export { BundleAnalytics, type BundleMetrics, type AnalyticsReport } from './bundle-analytics.js';
```

### Create `packages/pump-agent-swarm/src/intelligence/index.ts`

```typescript
export { StrategyBrain, type StrategyDecision, type BrainConfig } from './strategy-brain.js';
export { SignalGenerator, type Signal, type SignalConfig } from './signal-generator.js';
export { RiskManager, type RiskAssessment, type RiskConfig } from './risk-manager.js';
export { SentimentAnalyzer, type Sentiment, type SentimentConfig } from './sentiment-analyzer.js';
export { TrendDetector, type Trend, type TrendConfig } from './trend-detector.js';
export { TokenEvaluator, type TokenScore, type EvalConfig } from './token-evaluator.js';
export { MarketRegime, type Regime, type RegimeConfig } from './market-regime.js';
export { AlphaScanner, type AlphaSignal, type ScannerConfig } from './alpha-scanner.js';
export { NarrativeGenerator, type Narrative, type NarrativeConfig } from './narrative-generator.js';
export { PortfolioOptimizer, type PortfolioAllocation, type OptimizerConfig } from './portfolio-optimizer.js';
```

### Create `packages/pump-agent-swarm/src/coordination/index.ts`

```typescript
export { SwarmOrchestrator, type OrchestratorConfig, type SwarmStatus } from './swarm-orchestrator.js';
export { AgentMessenger, type Message, type MessageConfig } from './agent-messenger.js';
export { ConsensusEngine, type ConsensusResult, type Vote } from './consensus-engine.js';
export { TaskDelegator, type Task, type TaskResult } from './task-delegator.js';
export { LifecycleManager, type LifecyclePhase, type LifecycleConfig } from './lifecycle-manager.js';
export { HealthMonitor, type HealthReport, type HealthConfig } from './health-monitor.js';
export { PhaseController, type PhaseConfig, type PhaseTransition } from './phase-controller.js';
export { RollbackManager, type Checkpoint, type RollbackConfig } from './rollback-manager.js';
export { AuditLogger, type AuditEntry, type AuditConfig } from './audit-logger.js';
export { SwarmConfigManager, type RuntimeConfig, type ConfigDiff } from './swarm-config-manager.js';
```

### Create `packages/pump-agent-swarm/src/dashboard/index.ts`

```typescript
export { DashboardServer, type DashboardConfig } from './server.js';
export { WebSocketHub, type WsMessage, type WsConfig } from './websocket.js';
export { apiRoutes, type ApiResponse } from './api-routes.js';
export { TradeVisualizer, type TradeVisualization } from './trade-visualizer.js';
export { AgentMonitor, type AgentMonitorView } from './agent-monitor.js';
export { PnLDashboard, type PnLView } from './pnl-dashboard.js';
export { SupplyChart, type SupplyData } from './supply-chart.js';
export { EventTimeline, type TimelineEvent } from './event-timeline.js';
export { AlertManager, type Alert, type AlertConfig } from './alert-manager.js';
export { ExportManager, type ExportFormat, type ExportResult } from './export-manager.js';
```

### Create `packages/pump-agent-swarm/src/demo/index.ts`

```typescript
export { SwarmCLI, type CLIConfig } from './cli-runner.js';
export { DemoMode, type DemoConfig, type DemoStep } from './demo-mode.js';
export { PresentationMode, type PresentationConfig } from './presentation.js';
```

### Update `packages/pump-agent-swarm/src/index.ts` (Root Barrel)

```typescript
// Core types and config
export * from './types.js';
export * from './config/index.js';

// Infrastructure
export * from './infra/index.js';

// Agents
export * from './agents/index.js';

// Trading engine
export * from './trading/index.js';

// Bundle system
export * from './bundle/index.js';

// Intelligence layer
export * from './intelligence/index.js';

// Coordination
export * from './coordination/index.js';

// Dashboard
export * from './dashboard/index.js';

// Telegram bot
export * from './telegram/index.js';

// Database persistence
export * from './persistence/index.js';

// Demo & CLI
export * from './demo/index.js';

// Re-export existing modules
export { strategies } from './strategies.js';
export { WalletManager } from './wallet-manager.js';
```

### Important: Adapt exports to actual code

The exact export names above are educated guesses based on the prompt specifications. When actually building this file:

1. **Read each source file** to find the actual class/interface/type names
2. **Match exports to actual exports** — if a file uses `export default`, use `export { default as ClassName } from`
3. **Resolve naming conflicts** — if two modules export `Config`, rename in the barrel: `export { Config as AgentConfig } from`
4. **Verify with `tsc`** — run `npx tsc --noEmit` to catch any import mismatches
5. **Use `.js` extensions** — ESM requires explicit extensions in import paths

### Success Criteria

- Every subdirectory has an `index.ts` barrel export
- Root `src/index.ts` re-exports all module groups
- `import { SwarmOrchestrator, CreatorAgent, JitoClient } from '@crypto-vision/pump-agent-swarm'` works
- Sub-path imports work: `import { CreatorAgent } from '@crypto-vision/pump-agent-swarm/agents'`
- No naming conflicts between modules
- No circular dependency issues
- Compiles with `npx tsc --noEmit`
