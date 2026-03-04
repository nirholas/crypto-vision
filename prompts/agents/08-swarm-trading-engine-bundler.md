# Prompt 08 — Pump Agent Swarm: Trading Engine & Bundle System

## Context

You are working on `packages/pump-agent-swarm/` in the crypto-vision monorepo. The trading engine (`src/trading/`) and bundle system (`src/bundle/`) are the core execution layer for all swarm operations on Solana.

## Trading Engine Files (`src/trading/`)

| File | Purpose |
|------|---------|
| `order-router.ts` | Routes orders to Pump.fun bonding curve or Jito bundles |
| `position-manager.ts` | Tracks open positions per agent, calculates unrealized PnL |
| `pnl-tracker.ts` | FIFO cost-basis P&L tracking |
| `trade-scheduler.ts` | Schedules trades per strategy (intervals, randomization) |
| `gas-optimizer.ts` | Optimizes priority fees and Jito tips |
| `slippage-calculator.ts` | Calculates expected slippage on bonding curve |
| `volume-generator.ts` | Generates organic-looking volume patterns |
| `wash-engine.ts` | Coordinates buy/sell wash trades across wallets |
| `wallet-rotation.ts` | Rotates wallets for anti-detection |
| `price-trajectory.ts` | Models expected price trajectory on bonding curve |
| `profit-consolidator.ts` | Consolidates profits from trader wallets to master |

## Bundle System Files (`src/bundle/`)

| File | Purpose |
|------|---------|
| `bundle-coordinator.ts` | Orchestrates multi-wallet bundle buys |
| `jito-client.ts` | Jito Block Engine client for bundle submission |
| `bundle-validator.ts` | Validates bundle transactions before submission |
| `launch-sequencer.ts` | Sequences the token launch: mint → dev buy → bundle buys |
| `supply-distributor.ts` | Distributes token supply across wallets |
| `anti-detection.ts` | Anti-detection patterns (timing, amounts, wallet age) |
| `timing-engine.ts` | Optimizes transaction timing for block inclusion |
| `dev-buy-optimizer.ts` | Optimizes the dev buy amount on curve |
| `wallet-funder.ts` | Funds trader wallets with SOL from master |
| `bundle-analytics.ts` | Tracks bundle success rates and costs |

## Task

### 1. Complete the Order Router

The order router is the critical path for all trades:

```typescript
// OrderRouter should:
// 1. Accept a TradeOrder from any agent
// 2. Check wallet balance (SOL for buys, tokens for sells)
// 3. Calculate slippage (using SlippageCalculator)
// 4. Choose execution method: direct transaction OR Jito bundle
// 5. Build the Solana transaction:
//    - For buys: call Pump.fun's buy instruction on the bonding curve
//    - For sells: call Pump.fun's sell instruction on the bonding curve
// 6. Set priority fee (using GasOptimizer)
// 7. Submit transaction (direct or via Jito)
// 8. Confirm transaction
// 9. Return TradeResult with actual execution price and amounts
// 10. Emit trade events
```

Must handle real Pump.fun IDL instructions — refer to `src/pump-sdk.d.ts` for the interface.

### 2. Complete Position Manager

```typescript
// PositionManager should:
// 1. Track token holdings per wallet/agent
// 2. Calculate average entry price (FIFO)
// 3. Calculate unrealized PnL given current bonding curve price
// 4. Track total invested SOL and total received SOL
// 5. Provide position summaries for the dashboard
// 6. Handle partial fills
```

### 3. Complete the Jito Bundle Client

```typescript
// JitoClient should:
// 1. Connect to Jito Block Engine (mainnet: https://mainnet.block-engine.jito.wtf)
// 2. Submit transaction bundles (up to 5 txs per bundle)
// 3. Include Jito tip transaction (tip to Jito tip accounts)
// 4. Track bundle status (landed/dropped)
// 5. Retry with tip escalation on failure
// 6. Support both gRPC and HTTP bundle submission
```

Jito tip accounts (mainnet):
```
96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5
HFqU5x63VTqvQss8hp11i4bVqkfRtQ7NmXwkiCKnET7z
Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY
ADaUMid9yfUytqMBgopwjb2DTLSLimCcz28tGWRQwFan
DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh
ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt
DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL
3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT
```

### 4. Complete Bundle Coordinator

```typescript
// BundleCoordinator should:
// 1. Receive a BundleBuyConfig: { devBuyLamports, bundleWallets, slippageBps }
// 2. Create the atomic launch bundle:
//    a. Tx 1: Creator mints token + dev buy (atomic)
//    b. Tx 2-5: Bundle wallet buys (up to 4 more wallets)
// 3. All transactions in same Jito bundle → land in same block
// 4. Calculate total supply distribution after bundle
// 5. Validate bundle before submission
// 6. Handle failures: retry, refund, rollback
```

### 5. Complete Anti-Detection

```typescript
// AntiDetection should:
// 1. Randomize trade timing (Gaussian distribution around target interval)
// 2. Randomize trade sizes (within strategy bounds, not round numbers)
// 3. Vary priority fees (not always the same)
// 4. Rotate wallets (using WalletRotation)
// 5. Add human-like patterns:
//    - Slower trading during Solana off-hours
//    - Occasional pauses (simulate distraction)
//    - Vary buy/sell patterns (not strictly alternating)
// 6. Score detection risk (0-100) based on pattern analysis
```

### 6. Complete Supply Distributor

```typescript
// SupplyDistributor should:
// 1. After bundle launch, track token distribution across all wallets
// 2. Calculate concentration metrics: Gini, HHI, top holder %
// 3. Plan redistribution if too concentrated
// 4. Execute redistribution trades (wallet A sells, wallet B buys)
// 5. Track distribution over time for dashboard charts
```

### 7. Complete Profit Consolidator

```typescript
// ProfitConsolidator should:
// 1. After exit phase, sweep remaining tokens from all trader wallets
// 2. Sell remaining tokens on bonding curve
// 3. Transfer all SOL back to master wallet
// 4. Calculate final P&L report
// 5. Handle dust (tiny remaining balances)
```

### 8. Complete Trade Scheduler

```typescript
// TradeScheduler should:
// 1. Given a TradingStrategy, generate a schedule of trades
// 2. Decide buy vs sell based on buySellRatio (e.g., 2.33 = 70% buy, 30% sell)
// 3. Randomize intervals between minIntervalSeconds and maxIntervalSeconds
// 4. Randomize amounts between minTradeSizeLamports and maxTradeSizeLamports
// 5. Apply anti-detection patterns
// 6. Track budget remaining and stop when exhausted
// 7. Respect maxTrades and maxDurationSeconds limits
```

## Technical Requirements

- All Solana transactions must be real (not mocked)
- Use `@solana/web3.js` v1.x (Connection, Transaction, Keypair, SystemProgram, etc.)
- BN.js for all monetary amounts (never floating point for SOL/lamports)
- Proper transaction confirmation: `confirmed` or `finalized` commitment
- Error handling for ALL Solana-specific errors: InsufficientFunds, SlippageExceeded, BlockhashNotFound, etc.
- Structured logging via the infrastructure Logger
- Metrics via the infrastructure Metrics
- No `any` types

## Verification

1. `npm run typecheck` passes
2. `npm run build` succeeds
3. OrderRouter can construct a valid Pump.fun buy/sell transaction
4. JitoClient can format a valid bundle payload
5. BundleCoordinator can plan a multi-wallet launch sequence
6. All modules export from their barrel files
