# Prompt 63 — Trade Visualizer

## Agent Identity & Rules

```
You are the TRADE-VISUALIZER builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real trade data formatting, real visualization-ready output
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add trade visualizer for flow diagrams and price charts"
```

## Objective

Create `packages/pump-agent-swarm/src/dashboard/trade-visualizer.ts` — formats raw trade data into visualization-ready structures for the dashboard including Sankey flow diagrams, agent interaction matrices, trade timelines, and price charts.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/dashboard/trade-visualizer.ts`

## Dependencies

- `../infra/event-bus` — SwarmEventBus (P04)
- `../types` — TradeResult, SwarmEvent (P01)
- `../infra/logging` — SwarmLogger (P07)

## Deliverables

### Create `packages/pump-agent-swarm/src/dashboard/trade-visualizer.ts`

1. **`TradeVisualizer` class**:
   - `constructor(eventBus: SwarmEventBus)`
   - `recordTrade(trade: TradeRecord): void` — ingest a new trade
   - `getTradeFlow(timeRange?: TimeRange): TradeFlowData` — Sankey diagram data
   - `getAgentInteractions(): AgentInteractionMatrix` — NxN interaction matrix
   - `getTradeTimeline(limit: number): TradeTimelineEntry[]` — chronological trade list
   - `getPriceChart(): PriceChartData` — price time series with trade markers
   - `getVolumeChart(): VolumeChartData` — volume over time bars
   - `getTradeStats(): TradeStatistics` — aggregate statistics
   - `clear(): void` — reset all stored data

2. **`TradeRecord` interface**:
   ```typescript
   interface TradeRecord {
     /** Unique trade identifier */
     id: string;
     /** Transaction signature */
     signature: string;
     /** Timestamp of execution */
     timestamp: number;
     /** Agent that initiated the trade */
     agentId: string;
     /** Agent wallet address */
     walletAddress: string;
     /** Trade direction */
     direction: 'buy' | 'sell';
     /** SOL amount */
     solAmount: number;
     /** Token amount */
     tokenAmount: number;
     /** Price at execution (SOL per token) */
     price: number;
     /** Slippage from expected */
     slippage: number;
     /** Priority fee paid (lamports) */
     priorityFee: number;
     /** Whether trade was successful */
     success: boolean;
     /** Counterparty agent ID if internal trade */
     counterpartyAgentId?: string;
   }
   ```

3. **`TradeFlowData` interface** (for Sankey diagrams):
   ```typescript
   interface TradeFlowData {
     /** Nodes represent agents */
     nodes: TradeFlowNode[];
     /** Links represent trades between agents */
     links: TradeFlowLink[];
     /** Total volume in SOL */
     totalVolume: number;
     /** Time range covered */
     timeRange: TimeRange;
   }

   interface TradeFlowNode {
     id: string;
     label: string;
     type: string;
     totalVolume: number;
     tradeCount: number;
     color: string;
   }

   interface TradeFlowLink {
     source: string;
     target: string;
     value: number;
     tradeCount: number;
     direction: 'buy' | 'sell';
   }
   ```

4. **`AgentInteractionMatrix` interface**:
   ```typescript
   interface AgentInteractionMatrix {
     /** Agent IDs in order */
     agents: string[];
     /** NxN matrix of SOL volume between agents */
     volumeMatrix: number[][];
     /** NxN matrix of trade counts between agents */
     countMatrix: number[][];
   }
   ```

5. **`PriceChartData` interface**:
   ```typescript
   interface PriceChartData {
     /** Price points over time */
     prices: Array<{ timestamp: number; price: number }>;
     /** Trade markers overlaid on price chart */
     tradeMarkers: Array<{
       timestamp: number;
       price: number;
       direction: 'buy' | 'sell';
       agentId: string;
       solAmount: number;
     }>;
     /** Current price */
     currentPrice: number;
     /** Price high */
     high: number;
     /** Price low */
     low: number;
   }
   ```

6. **`VolumeChartData` interface**:
   ```typescript
   interface VolumeChartData {
     /** Volume bars */
     bars: Array<{
       timestamp: number;
       buyVolume: number;
       sellVolume: number;
       netVolume: number;
       tradeCount: number;
     }>;
     /** Bar interval in ms */
     intervalMs: number;
   }
   ```

7. **`TradeStatistics` interface**:
   ```typescript
   interface TradeStatistics {
     totalTrades: number;
     successfulTrades: number;
     failedTrades: number;
     totalBuyVolumeSol: number;
     totalSellVolumeSol: number;
     averageTradeSize: number;
     medianTradeSize: number;
     largestTrade: number;
     averageSlippage: number;
     totalFeesLamports: number;
     uniqueAgents: number;
     tradesPerMinute: number;
     firstTradeAt: number;
     lastTradeAt: number;
   }
   ```

8. **Core behavior**:
   - Subscribe to `trade:executed` events on the event bus and auto-ingest
   - Store trades in an in-memory array (max 50,000 entries, FIFO eviction)
   - Build interaction matrix on-the-fly as trades come in
   - Price chart tracks bonding curve price at each trade
   - Volume bars aggregate into configurable intervals (default 60s)

### Success Criteria

- Trades ingested from event bus automatically
- Sankey flow data correctly represents agent-to-agent trade flows
- Price chart data includes all trade markers
- Volume bars aggregate correctly by time interval
- Statistics computed accurately across all trades
- Compiles with `npx tsc --noEmit`
