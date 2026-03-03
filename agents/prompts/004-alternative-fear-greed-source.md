# Prompt 004 — Alternative.me & Fear/Greed Source Adapter

## Preamble — Read Every Time

You are an expert TypeScript engineer building **cryptocurrency.cv**, the most comprehensive crypto/DeFi API infrastructure. Stack: **Hono + TypeScript + Node.js**, Google Cloud Run, Redis caching, Zod validation.

### Absolute Rules

1. **Never mock, stub, or fake anything.** Real implementations only.
2. **TypeScript strict mode** — no `any`, no `@ts-ignore`.
3. **Every async call** needs try/catch, every response needs validation.
4. **Always kill terminals** after commands complete.
5. **Always commit and push** as `nirholas`.
6. **If close to hallucinating** — stop and tell the prompter.
7. **Always improve existing code** you touch.
8. **Run `npx tsc --noEmit` and `npx vitest run`** after changes.

### Conventions

- `@/` alias → `src/`, `.js` extensions, named exports, Zod schemas
- `fetchJSON` from `@/lib/fetcher.js`, `cache.wrap()` for all fetches

---

## Task

Build the **complete Alternative.me source adapter** at `src/sources/alternative.ts`. This covers the Fear & Greed Index, Bitcoin dominance, mempool fees, hashrate, and DEX token pair data from DexScreener.

### API Base URLs

```
https://api.alternative.me               # Fear/Greed, global data
https://mempool.space/api                 # Bitcoin fees, hashrate, blocks
https://api.dexscreener.com/latest        # DEX token pairs, trending
https://api.blockchain.info               # Bitcoin network stats
```

### Requirements

#### 1. Zod Schemas

- `FearGreedEntry` — value (string "0"-"100"), value_classification, timestamp, time_until_update
- `FearGreedResponse` — name, data array, metadata
- `BitcoinFees` — fastestFee, halfHourFee, hourFee, economyFee, minimumFee
- `BitcoinHashrate` — currentHashrate, currentDifficulty
- `MempoolStats` — count, vsize, total_fee, fee_histogram
- `BlockInfo` — height, hash, timestamp, size, weight, tx_count, difficulty
- `DexPair` — chainId, dexId, pairAddress, baseToken, quoteToken, priceNative, priceUsd, txns, volume, liquidity, fdv, pairCreatedAt, info
- `DexSearchResult` — pairs array
- `DexTokenProfile` — url, chainId, tokenAddress, icon, description, links

#### 2. Exported Functions

**Fear & Greed:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getFearGreedIndex(limit?)` | `/fng/?limit={limit}` | 120s |
| `getFearGreedHistory(days)` | `/fng/?limit={days}` | 600s |
| `getCurrentSentiment()` | `/fng/?limit=1` | 120s |
| `getSentimentTrend(days)` | Compute from history | 600s |

**Bitcoin Network (Mempool):**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getBitcoinFees()` | `/v1/fees/recommended` | 30s |
| `getMempoolStats()` | `/mempool` | 30s |
| `getRecentBlocks(count?)` | `/v1/blocks` | 60s |
| `getBlockDetails(hashOrHeight)` | `/block/{hash}` | 3600s |
| `getTransactionDetails(txid)` | `/tx/{txid}` | 3600s |
| `getDifficultyAdjustment()` | `/v1/difficulty-adjustment` | 300s |
| `getMempoolFeeHistogram()` | `/mempool` | 30s |
| `getBitcoinHashrate()` | `/v1/mining/hashrate/3d` | 300s |

**DEX (DexScreener):**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `dexTokenPairs(address)` | `/dex/tokens/{address}` | 30s |
| `dexPairByAddress(chain, pair)` | `/dex/pairs/{chain}/{pair}` | 30s |
| `dexSearch(query)` | `/dex/search?q={query}` | 60s |
| `getLatestTokenProfiles()` | `/token-profiles/latest/v1` | 120s |
| `getTopBoostedTokens()` | `/token-boosts/top/v1` | 120s |
| `getTrendingDexPairs(chain?)` | Sort by volume from search | 60s |

**Blockchain.info:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getBitcoinPrice()` | `/ticker` | 30s |
| `getUnconfirmedTxCount()` | `/q/unconfirmedcount` | 60s |
| `getBitcoinDifficulty()` | `/q/getdifficulty` | 300s |

#### 3. Composite Analytics

```typescript
export function analyzeSentimentTrend(history: FearGreedEntry[]): {
  trend: 'improving' | 'declining' | 'stable';
  avgValue: number;
  volatility: number;
  currentVsPrevWeek: number;
}

export function analyzeMempoolCongestion(stats: MempoolStats, fees: BitcoinFees): {
  congestionLevel: 'low' | 'medium' | 'high' | 'extreme';
  estimatedClearTime: number; // minutes
  feeRecommendation: { priority: string; fee: number }[];
}

export function analyzeDexTokenHealth(pairs: DexPair[]): {
  totalLiquidity: number;
  totalVolume24h: number;
  buyPressure: number; // ratio of buys to sells
  topDex: string;
  priceConsensus: number; // how close prices are across DEXes
}
```

#### 4. Data Normalization

- Normalize DexScreener chain IDs to standard names
- Convert Fear & Greed timestamps (Unix strings) to ISO dates
- Normalize fee rates across different units (sat/vB, BTC, USD)

### Acceptance Criteria

- [ ] File compiles with zero errors
- [ ] All Fear/Greed + Bitcoin + DEX functions implemented
- [ ] Zod schemas validate all response shapes
- [ ] Composite analytics produce meaningful results
- [ ] `src/routes/onchain.ts` imports work
- [ ] All tests pass, committed and pushed as `nirholas`
- [ ] All terminals killed

### Hallucination Warning

DexScreener's API structure changes frequently. The `/latest/dex/tokens/{address}` path may differ — verify the actual endpoint. Mempool.space's fee histogram format is `[[feeRate, vsize], ...]` — don't assume it's an object. If unsure, tell the prompter.
