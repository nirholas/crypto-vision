# Prompt 28 — Position Manager

## Agent Identity & Rules

```
You are the POSITION-MANAGER builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add cross-agent position manager with supply tracking"
```

## Objective

Create `packages/pump-agent-swarm/src/trading/position-manager.ts` — tracks the aggregate token position across ALL agent wallets, calculates total supply percentage owned, manages position limits, and coordinates rebalancing between wallets.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/trading/position-manager.ts`

## Dependencies

- `../types.ts` — `AgentWallet`, `BondingCurveState` (P01)
- `../infra/event-bus.ts` — `SwarmEventBus` (P04)
- `../infra/logger.ts` — `SwarmLogger` (P07)
- `../infra/metrics.ts` — `MetricsCollector` (P08)
- `@solana/web3.js` — `Connection`, `PublicKey`
- `@solana/spl-token` — `getAssociatedTokenAddress`, `transfer`
- `bn.js` — `BN`

## Deliverables

### Create `packages/pump-agent-swarm/src/trading/position-manager.ts`

1. **`PositionManager` class**:
   - `constructor(connection: Connection, eventBus: SwarmEventBus)`
   - `trackToken(mint: string): void` — start tracking a token
   - `refreshPositions(): Promise<void>` — refresh all wallet token balances
   - `getAggregatePosition(mint: string): AggregatePosition`
   - `getWalletPosition(mint: string, walletAddress: string): WalletPosition`
   - `getSupplyPercentage(mint: string): Promise<number>` — what % of total supply do agents control
   - `setPositionLimit(mint: string, maxPercent: number): void`
   - `isOverLimit(mint: string): boolean`
   - `suggestRebalance(mint: string): RebalanceSuggestion[]`
   - `executeRebalance(suggestion: RebalanceSuggestion): Promise<string>` — SPL token transfer between wallets
   - `getTotalValue(mint: string): Promise<BN>` — total position value in SOL at current price
   - `startAutoRefresh(intervalMs: number): void`
   - `stopAutoRefresh(): void`

2. **AggregatePosition**:
   ```typescript
   interface AggregatePosition {
     mint: string;
     totalTokens: BN;
     totalCostBasis: BN;          // Total SOL spent acquiring
     avgCostBasis: BN;            // Per-token average cost
     currentPrice: BN;            // Current spot price
     currentValue: BN;            // totalTokens * currentPrice
     unrealizedPnl: BN;           // currentValue - totalCostBasis
     unrealizedPnlPercent: number;
     supplyPercent: number;        // % of total token supply controlled
     walletCount: number;          // Wallets holding this token
     walletPositions: WalletPosition[];
     updatedAt: number;
   }
   ```

3. **WalletPosition**:
   ```typescript
   interface WalletPosition {
     walletAddress: string;
     agentId: string;
     tokens: BN;
     costBasis: BN;
     percentOfSwarmPosition: number;  // This wallet's share of total swarm position
     percentOfSupply: number;         // This wallet's share of total token supply
   }
   ```

4. **RebalanceSuggestion**:
   ```typescript
   interface RebalanceSuggestion {
     from: string;           // Wallet address
     to: string;             // Wallet address
     tokenAmount: BN;        // Tokens to transfer
     reason: string;         // Why this rebalance
   }
   ```

5. **Rebalancing logic**: If one wallet holds >25% of the swarm's total position, suggest distributing to wallets holding <5%. This prevents any single wallet from looking like a "whale."

6. **Position limits**: If aggregate supply percentage exceeds configured limit, reject further buys and emit `position:over-limit` event.

### Success Criteria

- Accurate aggregate position across all wallets
- Supply percentage calculation is correct
- Rebalance suggestions prevent concentration
- Position limits prevent overexposure
- Auto-refresh keeps data current
- SPL token transfers for rebalancing work
- Compiles with `npx tsc --noEmit`
