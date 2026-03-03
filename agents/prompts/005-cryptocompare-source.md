# Prompt 005 — CryptoCompare Source Adapter

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

Build the **complete CryptoCompare source adapter** at `src/sources/cryptocompare.ts`. CryptoCompare provides historical OHLCV, social stats, mining data, exchange volumes, and news — complementing CoinGecko with unique datasets.

### API Base URL

```
https://min-api.cryptocompare.com/data    # All endpoints
# Auth: Apikey header or &api_key= query param
# Env: CRYPTOCOMPARE_API_KEY
```

### Requirements

#### 1. Base Client

```typescript
function ccFetch<T>(path: string, params?: Record<string, string>, ttl?: number): Promise<T>
```

- Auth via `Authorization: Apikey {key}` header
- Free tier: 100K calls/month, 50 calls/sec
- Handle `Response` field (CryptoCompare wraps errors in `{ Response: "Error", Message: "..." }`)

#### 2. Zod Schemas

- `HistoData` — time, open, high, low, close, volumefrom, volumeto, conversionType, conversionSymbol
- `PriceResponse` — `Record<string, Record<string, number>>` (multi from/to)
- `PairData` — exchange, fromSymbol, toSymbol, volume24h, volume24hTo, price, lastUpdate
- `TopExchangeVolume` — exchange, volume, exchange_grade
- `SocialStats` — General, CryptoCompare, Twitter, Reddit, Facebook, CodeRepository
- `BlockchainData` — hashrate, difficulty, block_time, block_size, current_supply
- `MiningEquipment` — id, name, algorithm, cost, power, hashrate_per_second
- `NewsArticle` — id, guid, title, body, categories, source_info, published_on, imageurl, url, tags

#### 3. Exported Functions

**Prices:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getPrice(fsym, tsyms)` | `/price` | 15s |
| `getMultiPrice(fsyms, tsyms)` | `/pricemulti` | 15s |
| `getFullPrice(fsyms, tsyms)` | `/pricemultifull` | 30s |
| `generateCustomAverage(fsym, tsym, exchange)` | `/generateAvg` | 30s |

**Historical OHLCV:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getHistoMinute(fsym, tsym, limit?)` | `/v2/histominute` | 60s |
| `getHistoHour(fsym, tsym, limit?, aggregate?)` | `/v2/histohour` | 120s |
| `getHistoDay(fsym, tsym, limit?, aggregate?)` | `/v2/histoday` | 300s |
| `getDailyAverage(fsym, tsym, toTs?)` | `/dayAvg` | 600s |
| `getHistoOHLCV(fsym, tsym, period, limit)` | Auto-select histo endpoint | varies |

**Exchange & Volume:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getTopExchangesByPair(fsym, tsym, limit?)` | `/top/exchanges` | 120s |
| `getTopExchangesFull(fsym, tsym, limit?)` | `/top/exchanges/full` | 120s |
| `getExchangeVolume(exchange)` | `/exchange/histoday` | 300s |
| `getAllExchanges()` | `/all/exchanges` | 3600s |
| `getTopPairs(fsym, limit?)` | `/top/pairs` | 120s |

**Social & On-Chain:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getSocialStats(coinId)` | `/social/coin/latest` | 300s |
| `getHistoricalSocial(coinId, limit?)` | `/social/coin/histo/day` | 600s |
| `getBlockchainData(fsym)` | `/blockchain/latest` | 300s |
| `getHistoricalBlockchain(fsym, limit?)` | `/blockchain/histo/day` | 600s |

**Mining:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getMiningEquipment()` | `/mining/equipment` | 3600s |
| `getMiningContracts()` | `/mining/contracts` | 3600s |
| `getMiningPoolStats()` | `/mining/pools` | 3600s |

**News:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getLatestNews(categories?, lang?)` | `/v2/news/?lang={lang}` | 60s |
| `getNewsByCategory(category)` | `/v2/news/?categories={cat}` | 60s |
| `getNewsFeeds()` | `/news/feeds` | 3600s |
| `getNewsCategories()` | `/news/categories` | 3600s |

**Top & Discovery:**

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getTopByMarketCap(tsym, limit?)` | `/top/mktcapfull` | 120s |
| `getTopByVolume(tsym, limit?)` | `/top/totalvolfull` | 120s |
| `getTopByDirectVolume(tsym, limit?)` | `/top/totaltoptiervolfull` | 120s |

#### 4. Analytics Helpers

```typescript
export function calculateRSI(histoData: HistoData[], period?: number): number[]
export function calculateSMA(histoData: HistoData[], period: number): number[]
export function calculateEMA(histoData: HistoData[], period: number): number[]
export function calculateBollingerBands(histoData: HistoData[], period?: number, stdDev?: number): { upper: number[]; middle: number[]; lower: number[] }
export function calculateMACD(histoData: HistoData[]): { macdLine: number[]; signalLine: number[]; histogram: number[] }
export function calculateATR(histoData: HistoData[], period?: number): number[]
export function detectTrend(histoData: HistoData[]): { trend: 'bullish' | 'bearish' | 'sideways'; strength: number; pivotPoints: number[] }
export function calculateVolumeProfile(histoData: HistoData[]): { priceLevel: number; volume: number }[]
```

#### 5. Error Handling for CryptoCompare

CryptoCompare has a unique error format:
```json
{ "Response": "Error", "Message": "...", "HasWarning": false, "Type": 2, "RateLimit": {} }
```

- Parse this and throw a descriptive `FetchError` with the message
- Check `Response === "Success"` for valid data
- Handle `Type` codes for specific error categories

### Acceptance Criteria

- [ ] File compiles with zero errors
- [ ] All 30+ functions exported and fully implemented
- [ ] Technical analysis helpers are mathematically correct
- [ ] CryptoCompare-specific error format handled
- [ ] News data properly sanitized (HTML stripped from body)
- [ ] Historical data functions support configurable time ranges
- [ ] All tests pass, committed and pushed as `nirholas`
- [ ] All terminals killed

### Hallucination Warning

CryptoCompare wraps most responses in `{ Data: { Data: [...] } }` (double nested). The `v2` historical endpoints differ from `v1` in response shape. Social stats endpoint requires a numeric `coinId`, NOT a symbol — you'll need a lookup. If unsure, tell the prompter.
