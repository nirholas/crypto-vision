# Prompt 15 — Market Maker Agent

## Agent Identity & Rules

```
You are the MARKET-MAKER builder. Create the market making agent.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real bonding curve interactions
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add market maker agent with spread management and inventory control"
```

## Objective

Create `packages/pump-agent-swarm/src/agents/market-maker-agent.ts` — an agent that maintains liquidity by continuously placing buy and sell orders around the current price, managing spread, and controlling inventory.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/agents/market-maker-agent.ts`

## Dependencies

- `../types.ts` — `AgentWallet`, `BondingCurveState`, `TradeDirection` (P01)
- `../infra/event-bus.ts` — `SwarmEventBus` (P04)
- `../infra/logger.ts` — `SwarmLogger` (P07)
- `../infra/metrics.ts` — `MetricsCollector` (P08)
- `../infra/error-handler.ts` — `SwarmErrorHandler` (P09)
- `@solana/web3.js` — `Connection`
- `bn.js` — `BN`

## Deliverables

### Create `packages/pump-agent-swarm/src/agents/market-maker-agent.ts`

1. **`MarketMakerAgent` class**:
   - `constructor(wallet: AgentWallet, connection: Connection, config: MarketMakingConfig)`
   - `start(mint: string): void` — begin market making
   - `stop(): void`
   - `getSpread(): { bid: number; ask: number; mid: number; spreadPercent: number }`
   - `getInventory(): { tokens: BN; sol: BN; inventoryRatio: number }`
   - `adjustSpread(newSpreadPercent: number): void`
   - `adjustImbalance(newTarget: number): void`

2. **Market making logic**:
   - Continuously monitor bonding curve price
   - Place alternating buy/sell orders around mid-price
   - Buy slightly below current price (creates support)
   - Sell slightly above current price (takes spread profit)
   - Manage inventory: if too many tokens, bias toward selling; if too few, bias toward buying
   - Inventory ratio target: ~50% tokens, ~50% SOL

3. **Spread management**:
   - Dynamic spread based on volatility
   - Tighter spread when volume is high (more profit opportunities)
   - Wider spread when volume is low (more risk per trade)
   - Minimum spread: 1% (to cover transaction fees)
   - Maximum spread: 10%

4. **Price trajectory control**:
   - If `trailPriceUp` is true, gradually increase buy prices each cycle
   - Price increment: `priceIncrementPercent` per cycle
   - Creates organic-looking price appreciation
   - Ensures price only moves up when the agent is net buying

5. **Cycle management**:
   - Each cycle: evaluate position → decide direction → execute trade → wait
   - Cycle duration configurable (default: 30s)
   - Evaluate P&L every N cycles, adjust strategy if losing

6. **Risk controls**:
   - Max inventory deviation from target (e.g., no more than 80% in tokens)
   - Max loss per cycle before pausing
   - Circuit breaker if price drops more than 30% from peak

### Success Criteria

- Maintains two-sided market with configurable spread
- Inventory management prevents overexposure
- Price trajectory control creates gradual appreciation
- Cycle-based execution with proper timing
- Risk controls prevent excessive losses
- Compiles with `npx tsc --noEmit`
