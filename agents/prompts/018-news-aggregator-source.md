# Prompt 018 — News Aggregator Source (Multi-Provider News)

## Preamble — Read Every Time

You are an expert TypeScript engineer building **cryptocurrency.cv**. Stack: **Hono + TypeScript + Node.js**, Google Cloud Run, Redis caching, Zod validation.

### Absolute Rules

1. **Never mock, stub, or fake anything.** 2. **TypeScript strict mode.** 3. **Always kill terminals.** 4. **Commit and push as `nirholas`.** 5. **If close to hallucinating — tell the prompter.** 6. **Run `npx tsc --noEmit` and `npx vitest run`.**

---

## Task

Build `src/sources/news-aggregator.ts` — a unified news aggregation adapter pulling from multiple crypto news APIs, normalizing them into a single feed. Also build `src/sources/crypto-news.ts` for the CryptoPanic API.

### APIs

```
https://cryptopanic.com/api/v1        # CryptoPanic (Env: CRYPTOPANIC_API_KEY)
https://min-api.cryptocompare.com      # CryptoCompare news (already have key)
https://newsdata.io/api/1              # NewsData.io (Env: NEWSDATA_API_KEY) [optional]
```

### Requirements

#### 1. Unified News Schema

```typescript
const NormalizedArticle = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().optional(),
  body: z.string().optional(),
  url: z.string().url(),
  source: z.string(),             // "cryptopanic", "cryptocompare", "newsdata"
  sourceUrl: z.string().optional(),
  author: z.string().optional(),
  publishedAt: z.string().datetime(),
  categories: z.array(z.string()),
  coins: z.array(z.object({       // mentioned coins
    symbol: z.string(),
    name: z.string().optional(),
  })),
  sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
  importance: z.enum(['high', 'medium', 'low']).optional(),
  imageUrl: z.string().optional(),
  votes: z.object({
    positive: z.number(),
    negative: z.number(),
    important: z.number(),
    liked: z.number(),
    disliked: z.number(),
    lol: z.number(),
    toxic: z.number(),
    saved: z.number(),
    comments: z.number(),
  }).optional(),
})
```

#### 2. CryptoPanic Functions (src/sources/crypto-news.ts)

| Function | Endpoint | Cache TTL |
|----------|----------|-----------|
| `getCryptoPanicPosts(filter?, currencies?, regions?)` | `/posts/` | 60s |
| `getTrendingPosts()` | `/posts/?filter=hot` | 60s |
| `getRisingPosts()` | `/posts/?filter=rising` | 60s |
| `getBullishPosts()` | `/posts/?filter=bullish` | 60s |
| `getBearishPosts()` | `/posts/?filter=bearish` | 60s |
| `getNewsByCoin(symbol)` | `/posts/?currencies={symbol}` | 60s |
| `getImportantPosts()` | `/posts/?filter=important` | 60s |

#### 3. Aggregator Functions (src/sources/news-aggregator.ts)

```typescript
export async function getAggregatedNews(opts?: {
  coins?: string[];
  categories?: string[];
  sentiment?: string;
  limit?: number;
  since?: string;      // ISO datetime
}): Promise<NormalizedArticle[]>

export async function getBreakingNews(limit?: number): Promise<NormalizedArticle[]>
export async function getNewsByCoin(symbol: string, limit?: number): Promise<NormalizedArticle[]>
export async function getNewsByCategory(category: string, limit?: number): Promise<NormalizedArticle[]>
export async function getTrendingTopics(): Promise<{ topic: string; count: number; sentiment: string; coins: string[] }[]>
```

#### 4. News Analytics

```typescript
export function analyzeSentiment(articles: NormalizedArticle[]): {
  overall: 'bullish' | 'bearish' | 'neutral';
  score: number;           // -100 to 100
  breakdown: { positive: number; negative: number; neutral: number };
  topBullishCoins: string[];
  topBearishCoins: string[];
}

export function detectNewsSpikes(articles: NormalizedArticle[], coin: string): {
  coinMentions: number;
  avgMentionsPerHour: number;
  currentMentionsPerHour: number;
  isSpike: boolean;
  spikeMultiplier: number;
}

export function deduplicateNews(articles: NormalizedArticle[]): NormalizedArticle[]
// Deduplicate by similar titles (Levenshtein/Jaccard similarity > 0.8)

export function categorizeNews(articles: NormalizedArticle[]): Record<string, NormalizedArticle[]>
// Categories: market_analysis, regulation, defi, nft, security, exchange, technology, adoption
```

#### 5. Real-Time Feed (helper for WebSocket)

```typescript
export function buildNewsFeedState(): {
  addArticle: (article: NormalizedArticle) => void;
  getLatest: (limit: number) => NormalizedArticle[];
  getByCoin: (coin: string, limit: number) => NormalizedArticle[];
  getBreaking: () => NormalizedArticle[];
  onNewArticle: (callback: (article: NormalizedArticle) => void) => void;
}
```

### Acceptance Criteria

- [ ] Both files compile with zero errors
- [ ] CryptoPanic adapter properly handles auth and filters
- [ ] Aggregator merges multiple sources into unified format
- [ ] Deduplication works across sources
- [ ] Sentiment analysis produces meaningful scores
- [ ] `src/routes/news.ts` imports work
- [ ] All tests pass, committed and pushed as `nirholas`, terminals killed

### Hallucination Warning

CryptoPanic wraps responses in `{ count, next, previous, results: [...] }`. The `kind` field is "news", "media", or "analysis". Vote counts come from `votes` sub-object. If unsure about CryptoPanic's exact filter values, tell the prompter.
