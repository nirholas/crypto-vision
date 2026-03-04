# Prompt 23 — Wallet Rotation System

## Agent Identity & Rules

```
You are the WALLET-ROTATION builder. Create the wallet rotation system.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add wallet rotation system for anti-pattern trading"
```

## Objective

Create `packages/pump-agent-swarm/src/trading/wallet-rotation.ts` — manages which wallets are used for trading at any given time, ensuring no single wallet is overused and trading patterns look organic across multiple addresses.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/trading/wallet-rotation.ts`

## Dependencies

- `../types.ts` — `AgentWallet`, `TradeDirection` (P01)
- `../infra/logger.ts` — `SwarmLogger` (P07)

## Deliverables

### Create `packages/pump-agent-swarm/src/trading/wallet-rotation.ts`

1. **`WalletRotation` class**:
   - `constructor(wallets: AgentWallet[], config: RotationConfig)`
   - `getNextWallet(direction: TradeDirection): AgentWallet` — returns best wallet for next trade
   - `markUsed(address: string): void` — record wallet usage
   - `setCooldown(address: string, durationMs: number): void`
   - `isOnCooldown(address: string): boolean`
   - `getUsageStats(): Record<string, WalletUsageStats>`
   - `addWallet(wallet: AgentWallet): void`
   - `removeWallet(address: string): void`
   - `rebalanceUsage(): void` — reset usage counters periodically

2. **RotationConfig**:
   ```typescript
   interface RotationConfig {
     maxConsecutiveUses: number;       // Max trades from same wallet in a row (default: 3)
     cooldownAfterMaxMs: number;       // Cooldown duration after hitting max (default: 60_000)
     rotationStrategy: 'round-robin' | 'random' | 'least-used' | 'weighted-random';
     preferBuyerForBuys: boolean;      // Prefer wallets with SOL for buys
     preferSellerForSells: boolean;    // Prefer wallets with tokens for sells
     maxTradesPerWalletPerHour: number; // Rate limit per wallet
     trackingWindowMs: number;         // Window for usage tracking (default: 3_600_000)
   }
   ```

3. **WalletUsageStats**:
   ```typescript
   interface WalletUsageStats {
     address: string;
     totalTrades: number;
     tradesInWindow: number;
     lastUsedAt: number;
     consecutiveUses: number;
     onCooldown: boolean;
     cooldownEndsAt?: number;
     buyCount: number;
     sellCount: number;
   }
   ```

4. **Rotation strategies**:
   - `round-robin`: Cycle through wallets in order
   - `random`: Random selection weighted by availability
   - `least-used`: Always pick the wallet with fewest trades in the tracking window
   - `weighted-random`: Random but biased toward less-used wallets (exponential decay weighting)

5. **Smart selection**: When selecting a wallet, consider:
   - Wallet SOL balance (enough for buy + fees?)
   - Wallet token balance (has tokens to sell?)
   - Cooldown status (not on cooldown?)
   - Usage count (not overused?)
   - Last used time (sufficient gap?)

### Success Criteria

- No wallet exceeds max consecutive uses
- Cooldowns are enforced correctly
- All rotation strategies produce valid selections
- Smart selection considers balance + cooldown + usage
- Rate limits per wallet per hour are respected
- Compiles with `npx tsc --noEmit`
