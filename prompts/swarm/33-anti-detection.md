# Prompt 33 — Anti-Detection Patterns

## Agent Identity & Rules

```
You are the ANTI-DETECTION builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real randomization with cryptographically sound entropy
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add anti-detection patterns for organic-looking on-chain activity"
```

## Objective

Create `packages/pump-agent-swarm/src/bundle/anti-detection.ts` — a system that makes on-chain activity from the agent swarm look organic and human-generated rather than bot-driven. This covers amount randomization, timing jitter, wallet behavior profiling, and trade pattern obfuscation.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/bundle/anti-detection.ts`

## Dependencies

- `types.ts` — `AgentWallet`, `TradeOrder`
- `infra/event-bus.ts` — `SwarmEventBus`
- `infra/logger.ts` — structured logging
- Node.js `crypto` module for secure randomness

## Deliverables

### Create `packages/pump-agent-swarm/src/bundle/anti-detection.ts`

1. **`AntiDetection` class**:
   - `constructor(config: AntiDetectionConfig)`
   - `randomizeAmount(baseLamports: bigint, variancePercent: number): bigint` — add random variance to amounts
   - `randomizeAmountSOL(baseSOL: number, variancePercent: number): number` — convenience for SOL amounts
   - `jitterDelay(baseMs: number, maxJitterMs: number): Promise<void>` — random delay with jitter
   - `generateHumanTiming(): TradeTimingProfile` — returns realistic human-like timing parameters
   - `shouldSkipTrade(recentTrades: TradeHistoryEntry[]): boolean` — avoid obvious patterns
   - `getNextTradeDelay(strategy: string, recentTrades: TradeHistoryEntry[]): number` — smart delay
   - `obfuscateWalletPattern(wallets: AgentWallet[]): WalletRotationPlan` — plan wallet usage
   - `scoreDetectionRisk(recentActivity: OnChainActivity[]): DetectionRiskScore` — assess how bot-like recent activity looks
   - `generateNoiseTransaction(): NoiseTransactionConfig` — create innocuous transactions to break patterns
   - `validateTradeSequence(trades: TradeOrder[]): TradeSequenceValidation` — check a planned sequence for detectable patterns

2. **AntiDetectionConfig**:
   ```typescript
   interface AntiDetectionConfig {
     /** Minimum variance applied to all amounts (percent, 5-20 recommended) */
     minAmountVariance: number;
     /** Maximum variance applied to all amounts */
     maxAmountVariance: number;
     /** Base timing jitter range in ms */
     timingJitterRange: [number, number];
     /** Max trades per wallet per hour before forced cooldown */
     maxTradesPerWalletPerHour: number;
     /** Max trades per wallet per day */
     maxTradesPerWalletPerDay: number;
     /** Whether to insert noise transactions between real trades */
     enableNoiseTransactions: boolean;
     /** Probability of inserting a noise transaction (0-1) */
     noiseProbability: number;
     /** Min different wallets to cycle through before reusing one */
     minWalletRotation: number;
     /** Avoid round numbers (e.g., exactly 1.0 SOL) */
     avoidRoundNumbers: boolean;
     /** Add human-like patterns: occasional pauses, variable activity levels */
     humanPatternEmulation: boolean;
   }
   ```

3. **Amount randomization**:
   - Use `crypto.randomBytes()` — not `Math.random()` — for all entropy
   - Avoid round numbers: never trade exactly 0.1, 0.5, 1.0, 2.0 SOL etc.
   - Add gaussian-like noise: concentrate variance around 5-15%, tail out to maxVariance
   - Token amounts should also be irregular (not exactly 1000, 5000 etc.)
   - Convert between lamports and SOL with proper precision handling

4. **Timing patterns**:
   ```typescript
   interface TradeTimingProfile {
     /** Delay before first trade of session (simulate "opening app") */
     sessionStartDelay: number;
     /** Base interval between trades */
     baseInterval: number;
     /** Variance on interval */
     intervalJitter: number;
     /** Probability of a longer "distraction" pause */
     longPauseProbability: number;
     /** Duration of long pauses */
     longPauseRange: [number, number];
     /** Time of day weighting (humans trade less at 3am) */
     hourlyActivityWeights: number[];
     /** Burst trading periods (simulate "found an alpha" behavior) */
     burstProbability: number;
     burstTradeCount: [number, number];
     burstInterval: [number, number];
   }
   ```

5. **Wallet behavior profiling**:
   - Track per-wallet: trades in last hour, last 24h, last trade timestamp
   - Enforce cooldowns: if wallet has done N trades in last hour, force a cooldown period
   - Rotate wallets: never use same wallet for 3+ consecutive trades
   - Mix buy/sell per wallet: purely-buy wallets look suspicious
   - Some wallets should be "holders" that rarely trade (buy once, hold)
   - Some wallets should be "flippers" (buy, hold briefly, sell)

6. **Pattern detection self-audit**:
   ```typescript
   interface DetectionRiskScore {
     overall: number; // 0-100, higher = more detectable
     factors: {
       timingRegularity: number;    // How regular are trade intervals
       amountPatterns: number;      // How repetitive are amounts
       walletConcentration: number; // How concentrated is activity
       directionBias: number;       // How one-sided is buy vs sell
       volumeSpikes: number;        // How sudden are volume changes
       sameBlockClustering: number; // How many trades in same block/slot
     };
     recommendations: string[];
   }
   ```

7. **Noise transactions** (when enabled):
   - Wrap/unwrap SOL (natural activity)
   - Transfer small SOL between own wallets
   - Check token balance (no-op read transaction)
   - These break up the trading pattern on-chain

### Success Criteria

- All randomization uses `crypto.randomBytes()`, never `Math.random()`
- Amount variance is configurable and never produces round numbers
- Timing jitter produces realistic human-like delays
- Wallet rotation enforces cooldowns and prevents patterns
- Self-audit scoring correctly identifies obvious bot patterns
- Compiles with `npx tsc --noEmit`
