# Prompt 009 — GeckoTerminal Source Adapter (On-Chain DEX Data)

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

---

## Task

Build the **complete GeckoTerminal source adapter** at `src/sources/geckoterminal.ts`. GeckoTerminal (by CoinGecko) provides on-chain DEX data across 100+ networks — pools, tokens, OHLCV, trades, and trending data.

### API Base URL

```
https://api.geckoterminal.com/api/v2    # RESTful JSON:API format
# No auth needed, rate limit: 30 req/min
```

### Key Design Note

GeckoTerminal uses **JSON:API format** — responses have `data`, `attributes`, `relationships`, `included` fields. You must parse this format.

### Requirements

#### 1. JSON:API Parser

```typescript
// Build a generic parser for JSON:API responses
function parseJsonApi<T>(response: JsonApiResponse): T
function parseJsonApiCollection<T>(response: JsonApiResponse): T[]
// Handle included relationships, flatten attributes
```

#### 2. Zod Schemas

- `GTNetwork` — id, type, attributes: { name, coingecko_asset_platform_id, native_coin_id }
- `GTDex` — id, type, attributes: { name, identifier }
- `GTPool` — id, type, attributes: { name, address, base_token_price_usd, quote_token_price_usd, base_token_price_native_currency, volume_usd, reserve_in_usd, pool_created_at, fdv_usd, market_cap_usd, price_change_percentage }
- `GTToken` — id, type, attributes: { name, symbol, address, decimals, total_supply, price_usd, fdv_usd, total_reserve_in_usd, volume_usd, market_cap_usd, coingecko_coin_id }
- `GTOHLCV` — array of [timestamp, open, high, low, close, volume]
- `GTTrade` — id, type, attributes: { block_number, tx_hash, tx_from_address, from_token_amount, to_token_amount, price_from_in_usd, price_to_in_usd, kind, volume_in_usd }
- `GTTokenInfo` — name, symbol, address, image_url, websites, description, gt_score, discord_url, telegram_handle, twitter_handle

#### 3. Exported Functions

**Networks & DEXes:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getNetworks()` | `/networks` | 3600s |
| `getDexes(network)` | `/networks/{network}/dexes` | 3600s |

**Pools:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getTrendingPools(network?)` | `/networks/{network}/trending_pools` | 60s |
| `getTopPools(network)` | `/networks/{network}/pools` | 60s |
| `getNewPools(network?)` | `/networks/{network}/new_pools` | 30s |
| `getPoolByAddress(network, address)` | `/networks/{network}/pools/{address}` | 30s |
| `getMultiPools(network, addresses[])` | `/networks/{network}/pools/multi/{addresses}` | 30s |
| `getPoolsByToken(network, tokenAddress)` | `/networks/{network}/tokens/{token}/pools` | 60s |
| `searchPools(query)` | `/search/pools?query={query}` | 60s |

**Tokens:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getToken(network, address)` | `/networks/{network}/tokens/{address}` | 60s |
| `getMultiTokens(network, addresses[])` | `/networks/{network}/tokens/multi/{addresses}` | 60s |
| `getTokenInfo(network, address)` | `/networks/{network}/tokens/{address}/info` | 300s |
| `getTopTokens(network)` | `/networks/{network}/tokens` | 120s |

**OHLCV & Trades:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getPoolOHLCV(network, poolAddress, timeframe, params?)` | `/networks/{network}/pools/{pool}/ohlcv/{timeframe}` | 30s |
| `getPoolTrades(network, poolAddress, params?)` | `/networks/{network}/pools/{pool}/trades` | 15s |

**Trending & Discovery:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getGlobalTrendingPools()` | `/networks/trending_pools` | 60s |
| `getTrendingTokens(network)` | Derived from trending pools | 60s |

#### 4. Cross-Chain Analytics

```typescript
export function findCrossChainPools(token: string, networks: string[]): Promise<GTPool[]>
export function compareLiquidity(pools: GTPool[]): { network: string; liquidity: number; volume: number; priceUsd: number }[]
export function identifyNewListings(pools: GTPool[], maxAge: number): GTPool[]
export function calculatePoolHealth(pool: GTPool): {
  liquidityScore: number;     // 0-100 based on reserve
  volumeScore: number;        // 0-100 based on volume/liquidity ratio
  ageScore: number;           // 0-100 based on pool age
  overallScore: number;
  risks: string[];
}
export function detectRugPullSignals(pool: GTPool, trades: GTTrade[]): {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  signals: string[];
  liquidityLocked: boolean;
  topHolderConcentration: number;
}
```

#### 5. Chain ID Mapping

```typescript
export const NETWORK_MAP: Record<string, string> = {
  eth: "ethereum",
  bsc: "binance-smart-chain",
  polygon_pos: "polygon",
  arbitrum: "arbitrum",
  optimism: "optimism",
  base: "base",
  avalanche: "avalanche",
  solana: "solana",
  // ... 100+ chains
}
export function resolveNetworkId(input: string): string
```

### Acceptance Criteria

- [ ] File compiles with zero errors
- [ ] JSON:API format properly parsed and flattened
- [ ] All pool, token, OHLCV, and trade functions work
- [ ] Trending data aggregated across networks
- [ ] Pool health scoring produces meaningful results
- [ ] Rug pull detection identifies common signals
- [ ] Chain mapping covers all major networks
- [ ] `src/routes/dex.ts` imports work
- [ ] All tests pass, committed and pushed as `nirholas`
- [ ] All terminals killed

### Hallucination Warning

GeckoTerminal uses JSON:API format which is very different from standard REST. Responses have `data.attributes` not flat fields. OHLCV timeframes are: `day`, `hour`, `minute`. The pool ID format is `{network}_{pool_address}`. If unsure about response format, tell the prompter.
