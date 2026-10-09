# Prompt 45 — Token Evaluator

## Agent Identity & Rules

```
You are the TOKEN-EVALUATOR builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real on-chain and API data for evaluation
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add deep token evaluator for multi-criteria scoring"
```

## Objective

Create `packages/pump-agent-swarm/src/intelligence/token-evaluator.ts` — performs deep multi-criteria evaluation of Pump.fun tokens to decide whether they're worth buying. Scores bonding curve health, holder quality, volume authenticity, narrative strength, rug risk, and age/momentum.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/intelligence/token-evaluator.ts`

## Dependencies

- `@solana/web3.js` — `Connection`, `PublicKey`
- `@pump-fun/pump-sdk` — bonding curve decoding
- `types.ts` — `BondingCurveState`
- `infra/logger.ts` — structured logging
- Node.js `fetch` for Pump.fun API

## Deliverables

### Create `packages/pump-agent-swarm/src/intelligence/token-evaluator.ts`

1. **`TokenEvaluator` class**:
   - `constructor(connection: Connection, config?: EvaluatorConfig)`
   - `evaluateToken(mint: string): Promise<TokenEvaluation>` — full deep evaluation
   - `quickScore(mint: string): Promise<number>` — fast 0-100 score (skip expensive checks)
   - `compareTokens(mints: string[]): Promise<TokenComparison>` — rank multiple tokens
   - `getEvaluationHistory(): Map<string, TokenEvaluation>` — cached evaluations

2. **EvaluatorConfig**:
   ```typescript
   interface EvaluatorConfig {
     /** Pump.fun API base */
     pumpFunApiBase: string;
     /** Weights for each criteria (must sum to 1.0) */
     weights: {
       bondingCurveHealth: number;   // default: 0.20
       holderQuality: number;        // default: 0.20
       volumeAuthenticity: number;   // default: 0.15
       narrativeStrength: number;    // default: 0.15
       rugRisk: number;              // default: 0.20
       ageFactor: number;            // default: 0.10
     };
     /** Minimum score to recommend buying (0-100) */
     buyThreshold: number;           // default: 65
     /** Cache TTL for evaluations (ms) */
     cacheTtl: number;               // default: 60000
   }
   ```

3. **TokenEvaluation** — comprehensive output:
   ```typescript
   interface TokenEvaluation {
     mint: string;
     name: string;
     symbol: string;
     /** Overall weighted score (0-100) */
     overallScore: number;
     /** Per-criteria scores */
     scores: {
       bondingCurveHealth: CriterionScore;
       holderQuality: CriterionScore;
       volumeAuthenticity: CriterionScore;
       narrativeStrength: CriterionScore;
       rugRisk: CriterionScore;
       ageFactor: CriterionScore;
     };
     /** Recommendation based on overall score */
     recommendation: 'strong-buy' | 'buy' | 'hold' | 'avoid' | 'strong-avoid';
     /** Confidence in evaluation (0-1) */
     confidence: number;
     /** Key insights about this token */
     insights: string[];
     /** Red flags detected */
     redFlags: string[];
     /** Raw data used for evaluation */
     rawData: TokenRawData;
     evaluatedAt: number;
   }

   interface CriterionScore {
     score: number;                  // 0-100
     weight: number;                 // Configured weight
     weighted: number;               // score * weight
     details: string;                // Human-readable explanation
   }
   ```

4. **Scoring criteria — Bonding Curve Health (0-100)**:
   ```typescript
   // Read bonding curve account on-chain:
   // - Reserves ratio: virtualSolReserves vs virtualTokenReserves
   //   Score higher if ratio indicates healthy buying activity
   // - Distance to graduation: tokens closer to 85 SOL get higher scores
   //   (more liquidity, more mature)
   // - Price stability: calculate price variance from recent snapshots
   //   Lower variance = healthier = higher score
   // - Real vs virtual reserves ratio: higher real SOL = more actual buying
   ```

5. **Scoring criteria — Holder Quality (0-100)**:
   ```typescript
   // Fetch token holders via Solana RPC (getTokenLargestAccounts)
   // - Number of holders: more = better (up to a point)
   //   5-10 holders: 20pts, 10-50: 50pts, 50-200: 80pts, 200+: 100pts
   // - Distribution (Gini coefficient):
   //   Low concentration = good (democratic), high = bad (whale-dominated)
   // - Top holder percentage: if top holder has >50%, subtract 30pts
   // - Dev wallet behavior: has dev sold? If not, +20pts
   ```

6. **Scoring criteria — Volume Authenticity (0-100)**:
   ```typescript
   // Analyze recent transactions on the bonding curve:
   // - Trade count vs unique wallets: high ratio = wash trading = bad
   //   Unique wallets / total trades > 0.5 = authentic
   // - Buy/sell ratio: all buys or all sells = suspicious
   //   Healthy: 40-60% buy ratio
   // - Average trade size distribution: all same size = bot = bad
   //   Variance in trade sizes = organic = good
   // - Trade timing: regular intervals = bot, irregular = organic
   ```

7. **Scoring criteria — Narrative Strength (0-100)**:
   ```typescript
   // From Pump.fun API metadata:
   // - Name quality: short, memorable, relevant to trends = high
   // - Has description: +10pts
   // - Has image: +10pts
   // - Reply count (Pump.fun comments): more engagement = better
   //   0 replies: 10pts, 1-10: 40pts, 10-50: 70pts, 50+: 90pts
   // - Category alignment with trending: if category is hot, +20pts
   // - Meme potential: assess name for meme-ability
   ```

8. **Scoring criteria — Rug Risk (0-100, higher = SAFER)**:
   ```typescript
   // Risk factors (each deducts from 100):
   // - Dev holds >20% of supply: -20pts
   // - Dev has been selling: -30pts
   // - Single wallet holds >30% of supply: -25pts
   // - Token is very new (<5 min old): -15pts (could be honeypot)
   // - Very few holders (<5): -20pts
   // - No social proof (0 comments): -10pts
   // - PumpSwap pool exists but no liquidity: -30pts (potential rug)
   ```

9. **Scoring criteria — Age Factor (0-100)**:
   ```typescript
   // Token age vs momentum:
   // - Very new (<10 min) with high volume: 90pts (early gem potential)
   // - New (10 min - 1 hr) with growing volume: 80pts
   // - Recent (1-6 hrs) with sustained volume: 70pts
   // - Older (6-24 hrs) with declining volume: 40pts (fading)
   // - Old (>24 hrs) with flat volume: 20pts (stale)
   // - Old (>24 hrs) with NEW surge: 60pts (comeback potential)
   ```

10. **TokenComparison**:
    ```typescript
    interface TokenComparison {
      tokens: TokenEvaluation[];
      ranked: Array<{ mint: string; rank: number; score: number }>;
      bestPick: { mint: string; reasoning: string };
      comparedAt: number;
    }
    ```

11. **TokenRawData** (for transparency):
    ```typescript
    interface TokenRawData {
      pumpFunData: Record<string, unknown>;
      bondingCurveState: BondingCurveState | null;
      holderCount: number;
      topHolders: Array<{ address: string; balance: bigint; percent: number }>;
      recentTxCount: number;
      uniqueWallets: number;
      tokenAge: number;
      replyCount: number;
    }
    ```

### Success Criteria

- Reads real bonding curve data from Solana RPC
- Fetches real token metadata from Pump.fun API
- Holder analysis uses `getTokenLargestAccounts` on real mint
- Each scoring criterion is independently testable
- Overall score correctly weights criteria
- Token comparison ranks tokens meaningfully
- Compiles with `npx tsc --noEmit`
