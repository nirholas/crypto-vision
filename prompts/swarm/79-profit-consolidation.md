# Prompt 79 — Profit Consolidation Engine

## Agent Identity & Rules

```
You are the PROFIT-CONSOLIDATION builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real Solana transactions, real balance checks, real transfers
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add profit consolidation engine with treasury management and P&L-aware sweeps"
```

## Objective

Create `packages/pump-agent-swarm/src/trading/profit-consolidator.ts` — a profit-aware fund management engine that tracks invested principal per wallet, calculates realized profits, sweeps profits to a designated treasury wallet, and generates detailed P&L reports per sweep cycle. This goes beyond P03/P38's mechanical `reclaimAll()` to provide intelligent, auditable profit extraction that separates profits from principal.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/trading/profit-consolidator.ts`

## Dependencies

- `@solana/web3.js` for balance checks and SOL transfers
- `@solana/spl-token` for token account queries and closures
- WalletVault from `../wallet-manager.ts` (P03)
- WalletFunder from `../bundle/wallet-funder.ts` (P38)
- PnLTracker from `./pnl-tracker.ts` (P29)
- EventBus from `../infra/event-bus.ts` (P04)
- Logger from `../infra/logger.ts` (P07)
- TradeRepository from `../persistence/repositories.ts` (P74)
- Types from `../types.ts` (P01)

## Deliverables

### Create `packages/pump-agent-swarm/src/trading/profit-consolidator.ts`

1. **`ProfitConsolidator` class**:

   - `constructor(config: ConsolidatorConfig)`:
     ```typescript
     interface ConsolidatorConfig {
       connection: Connection;
       treasuryWallet: PublicKey;           // Where profits are swept to
       masterWallet: Keypair;               // Signs sweep transactions
       minProfitToSweep: number;            // Minimum SOL profit to trigger sweep (default: 0.01)
       sweepIntervalMs: number;             // Auto-sweep interval (default: 300_000 = 5 min)
       keepReservePercent: number;           // Percentage of profits to keep in trading wallets (default: 10)
       maxSweepBatchSize: number;           // Max wallets per sweep transaction (default: 10)
       enableAutoSweep: boolean;            // Whether to auto-sweep on interval
       closeDustTokenAccounts: boolean;     // Close token accounts worth < dust threshold
       dustThresholdSol: number;            // Value below which token account is "dust" (default: 0.001)
     }
     ```

   - `startAutoSweep(): void` — starts interval timer that calls `sweepProfits()` periodically
   - `stopAutoSweep(): void` — clears interval timer

   - `trackFunding(walletAddress: string, amountSol: number): void`
     - Records principal invested into this wallet
     - Maintains running total of all funds sent TO this wallet
     - Stores in `principalLedger: Map<string, WalletFundingRecord>`
     ```typescript
     interface WalletFundingRecord {
       walletAddress: string;
       totalFundedSol: number;         // Cumulative SOL sent to wallet
       fundingEvents: FundingEvent[];  // History of each funding
       createdAt: Date;
       lastFundedAt: Date;
     }
     
     interface FundingEvent {
       amountSol: number;
       txSignature: string;
       timestamp: Date;
       purpose: 'initial' | 'topup' | 'rebalance';
     }
     ```

   - `trackWithdrawal(walletAddress: string, amountSol: number): void`
     - Records SOL withdrawn/swept from this wallet
     - Deducts from tracked balance (NOT from principal — principal is always the original investment)

   - `async getWalletProfitability(walletAddress: string): Promise<WalletProfitability>`
     ```typescript
     interface WalletProfitability {
       walletAddress: string;
       principalInvestedSol: number;    // Total SOL ever funded to this wallet
       currentBalanceSol: number;       // Current SOL balance (on-chain)
       tokenValueSol: number;           // Estimated value of held tokens in SOL
       totalValueSol: number;           // currentBalanceSol + tokenValueSol
       realizedProfitSol: number;       // SOL already swept as profit
       unrealizedProfitSol: number;     // totalValueSol - principalInvestedSol - realizedProfitSol
       totalProfitSol: number;          // realizedProfitSol + unrealizedProfitSol
       roi: number;                     // totalProfitSol / principalInvestedSol * 100
       tradeCount: number;
       lastTradeAt: Date | null;
     }
     ```

   - `async sweepProfits(): Promise<SweepResult>`
     The core method. Algorithm:
     1. Iterate all tracked wallets
     2. For each wallet, fetch current SOL balance on-chain
     3. Calculate profit = currentBalance - principalInvested - rentExemptMinimum
     4. If profit > `minProfitToSweep`:
        - Calculate sweepAmount = profit × (1 - keepReservePercent/100)
        - Add to sweep batch
     5. If `closeDustTokenAccounts` is true:
        - Find token accounts with value < `dustThresholdSol`
        - Close them (reclaims rent SOL)
        - Add reclaimed rent to sweep amount
     6. Build batch transfer transaction(s) — max `maxSweepBatchSize` transfers per tx
     7. Send to treasury wallet
     8. Log every sweep as an audit event
     9. Update `realizedProfitSol` in the ledger

     ```typescript
     interface SweepResult {
       totalSweptSol: number;
       walletsSwept: number;
       walletsFailed: number;
       dustAccountsClosed: number;
       rentReclaimedSol: number;
       txSignatures: string[];
       details: WalletSweepDetail[];
       timestamp: Date;
     }
     
     interface WalletSweepDetail {
       walletAddress: string;
       balanceBefore: number;
       profitSol: number;
       sweptSol: number;
       reserveKeptSol: number;
       txSignature: string | null;
       error?: string;
     }
     ```

   - `async sweepAll(): Promise<SweepResult>`
     - Emergency sweep: transfers ALL SOL from ALL wallets (not just profits) to treasury
     - Closes ALL token accounts
     - Used during emergency exit or session end
     - Different from `sweepProfits()` — this ignores principal tracking

   - `async rebalanceWallets(targetBalanceSol: number): Promise<RebalanceResult>`
     ```typescript
     interface RebalanceResult {
       overFundedWallets: number;    // Wallets that had excess moved out
       underFundedWallets: number;   // Wallets that received top-ups
       totalMovedSol: number;
       txSignatures: string[];
     }
     ```
     - Checks each active wallet's balance
     - Wallets above targetBalance: sweep excess to treasury
     - Wallets below targetBalance: fund from master wallet
     - Net effect: all active wallets at approximately same balance
     - Useful for maintaining consistent trade sizes across wallet pool

   - `async generateProfitReport(sessionId?: string): Promise<ProfitReport>`
     ```typescript
     interface ProfitReport {
       generatedAt: Date;
       sessionId: string | null;
       summary: {
         totalPrincipalInvested: number;
         totalCurrentValue: number;
         totalRealizedProfit: number;
         totalUnrealizedProfit: number;
         totalProfit: number;
         overallRoi: number;
         totalSweepCount: number;
         totalSweptSol: number;
       };
       walletBreakdown: WalletProfitability[];
       topPerformers: WalletProfitability[];     // Top 5 by ROI
       underPerformers: WalletProfitability[];   // Bottom 5 by ROI
       sweepHistory: SweepResult[];
       treasuryBalance: number;
     }
     ```

   - `async getConsolidationStatus(): Promise<ConsolidationStatus>`
     ```typescript
     interface ConsolidationStatus {
       autoSweepEnabled: boolean;
       lastSweepAt: Date | null;
       nextSweepAt: Date | null;
       trackedWallets: number;
       totalPrincipal: number;
       totalUnsweptProfits: number;
       treasuryBalance: number;
     }
     ```

2. **Event emissions**:
   - `profit:swept` — after each successful sweep, with `SweepResult`
   - `profit:report` — after generating profit report, with `ProfitReport`
   - `profit:milestone` — when total profits cross round numbers (1 SOL, 5 SOL, 10 SOL, etc.)
   - `wallet:rebalanced` — after rebalance operation, with `RebalanceResult`
   - `dust:cleaned` — after closing dust token accounts

3. **Integration with WalletFunder (P38)**:
   - When P38's `fundWallets()` executes, `ProfitConsolidator.trackFunding()` is called automatically
   - When P38's `reclaimAll()` executes, `ProfitConsolidator.trackWithdrawal()` is called
   - This can be wired via EventBus: `eventBus.on('wallet:funded', ...)`

4. **Persistence integration (P74)**:
   - Store `principalLedger` entries in the database so tracking survives restarts
   - Store `sweepHistory` for audit trail
   - On startup, load existing ledger from database

5. **Safety features**:
   - Never sweep below rent-exempt minimum (0.00203928 SOL)
   - Verify treasury wallet is valid and not a burn address
   - Rate-limit sweeps to prevent transaction spam
   - Dry-run mode: `sweepProfits({ dryRun: true })` returns what WOULD be swept without sending transactions
   - Require minimum wallet age before sweeping (prevent sweeping from wallet that just received funds)
   - Transaction confirmation with `confirmed` commitment before marking sweep complete

### Success Criteria

- Principal tracking accurately records all funding events per wallet
- Profit calculation: profit = currentBalance - principalInvested (per wallet)
- `sweepProfits()` only transfers actual profits to treasury, leaving principal intact
- `sweepAll()` emergency sweep transfers everything regardless
- `rebalanceWallets()` normalizes balances across the wallet pool
- Profit reports include per-wallet breakdown with ROI
- Auto-sweep runs at configured interval without blocking main loop
- All sweeps logged as audit events via EventBus
- Dust token accounts closed and rent reclaimed
- Dry-run mode works without sending any transactions
- Compiles with `npx tsc --noEmit`
