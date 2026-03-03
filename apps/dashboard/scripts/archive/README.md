# Archive Scripts

Scripts for collecting, enriching, and managing the Free Crypto News historical archive.

## Overview

The v2 archive system:
- Runs **hourly** (vs every 6 hours in v1)
- **Appends** new articles (vs overwriting)
- **Enriches** every article with tickers, entities, sentiment, market context
- Stores in **JSONL** format (streamable, grep-able)
- Creates **hourly snapshots** of trending content
- Maintains **indexes** for fast lookups
- **Intelligence services** for market data, social signals, predictions, and more

## Quick Start

```bash
# Basic collection
node scripts/archive/collect.js

# Enhanced collection with all intelligence services
node scripts/archive/collect-enhanced.js

# With feature flags (disable expensive operations)
FEATURE_SOCIAL=false node scripts/archive/collect-enhanced.js
```

## Scripts

### `collect.js`
Basic collection script. Fetches news, enriches articles, appends to archive.

```bash
node scripts/archive/collect.js
```

### `collect-enhanced.js` ⭐ NEW
Full-featured collection with all intelligence services:

```bash
# Run with all features
node scripts/archive/collect-enhanced.js

# Environment variables
API_URL=https://free-crypto-news.vercel.app  # API base URL
ARCHIVE_DIR=./archive                         # Output directory
FEATURE_MARKET=true                           # Market data (CoinGecko, DeFiLlama)
FEATURE_ONCHAIN=true                          # On-chain events
FEATURE_SOCIAL=true                           # X/Twitter signals
FEATURE_PREDICTIONS=true                      # Prediction markets
FEATURE_CLUSTERING=true                       # Story clustering
FEATURE_RELIABILITY=true                      # Source reliability
X_AUTH_TOKEN=xxx                              # X/Twitter auth (optional)
```

### `migrate.js`
Migrates v1 archive files (JSON per day) to v2 format (JSONL per month).

### `enrich.js`
Core enrichment library. Extracts tickers, entities, sentiment, tags.

### `market-context.js`
Fetches current market data (BTC/ETH prices, Fear & Greed).

### `stats.js` 📊 NEW
Generates comprehensive monthly statistics for archive data.

**Features:**
- Article counts by source, ticker, sentiment
- Top people, companies, and protocols mentioned
- Daily distribution analysis
- Most persistent stories

```bash
# Generate stats for current month
node scripts/archive/stats.js

# Generate stats for specific month
node scripts/archive/stats.js 2026-01
```

```javascript
const { generateMonthlyStats } = require('./stats');
const stats = generateMonthlyStats('2026-01');
// Returns: { total_articles, by_source, by_ticker, by_sentiment, ... }
```

---

## Intelligence Services

All services are in the `services/` directory and can be used independently:

### `services/market-data.js` 📊
Comprehensive market intelligence from free APIs.

**Sources:**
- **CoinGecko** - Top 100 coins, trending, global stats
- **DeFiLlama** - Protocol TVL, yields, stablecoins
- **Alternative.me** - Fear & Greed Index

```javascript
const { MarketDataService } = require('./services/market-data');
const snapshot = await MarketDataService.getMarketSnapshot();
// Returns: { prices, trending, defi_tvl, fear_greed, ... }
```

### `services/onchain-events.js` ⛓️
On-chain activity tracking (no API keys required).

**Features:**
- Bitcoin network stats (blocks, hashrate, difficulty)
- Large transaction detection
- DEX volume tracking
- Bridge activity monitoring

```javascript
const { OnChainService } = require('./services/onchain-events');
const data = await OnChainService.getOnChainSnapshot();
```

### `services/x-signals.js` 🐦 NEW
X/Twitter social signals via [XActions](https://github.com/nirholas/XActions).

**Features:**
- Search crypto tweets (bitcoin, $BTC, #ethereum, etc.)
- Monitor influencer activity
- Sentiment analysis (bullish/bearish/neutral)
- Ticker mention tracking
- Engagement metrics

**Setup:**
```bash
# 1. Install XActions
npm install xactions

# 2. Login to X (one-time)
npx xactions login

# 3. Set environment variable
export X_AUTH_TOKEN="your_auth_token_cookie"
```

```javascript
const { SocialService } = require('./services/x-signals');
const signals = await SocialService.getSocialSnapshot();
// Returns: { trending_tickers, sentiment_summary, top_tweets, influencer_activity }
```

### `services/social-signals.js` 🔴 NEW
Reddit crypto sentiment tracking.

**Features:**
- Top posts from r/cryptocurrency, r/bitcoin, r/ethereum, r/solana, r/defi
- Subreddit activity (active users, subscribers)
- Sentiment analysis (bullish/bearish/neutral)
- Trending ticker mentions
- Engagement metrics

**Setup:**
```bash
# 1. Register Reddit app at reddit.com/prefs/apps (select "script")
# 2. Set environment variables
export REDDIT_CLIENT_ID="your_app_id"
export REDDIT_CLIENT_SECRET="your_secret"
```

```javascript
const { RedditService, SocialService } = require('./services/social-signals');
const reddit = await RedditService.getCryptoRedditSnapshot();
// Returns: { subreddits, top_posts, sentiment_summary, trending_tickers }
```

### `services/prediction-markets.js` 🎲
Crypto prediction market tracking.

**Sources:**
- **Polymarket** - Event prediction markets
- **Manifold Markets** - Community predictions

```javascript
const { PredictionService } = require('./services/prediction-markets');
const markets = await PredictionService.getPredictionSnapshot();
// Returns: { polymarket: [...], manifold: [...], combined_sentiment }
```

### `services/story-clustering.js` 🔗
Groups related articles into story clusters.

**Features:**
- Jaccard similarity for headline matching
- First-mover detection (who broke the story)
- Cluster timeline tracking
- Related article grouping

```javascript
const { ClusteringService } = require('./services/story-clustering');
const clusters = ClusteringService.clusterArticles(articles);
```

### `services/source-reliability.js` 📈
Tracks source performance and reliability.

**Metrics:**
- First-mover rate (breaking news frequency)
- Accuracy scoring
- Coverage patterns
- Credibility indicators

```javascript
const { ReliabilityService } = require('./services/source-reliability');
const stats = await ReliabilityService.getSourceStats();
```

### `services/analytics-engine.js` 📊
Generates analytics, digests, and trend reports.

**Features:**
- Daily/weekly news digests
- Narrative momentum tracking
- Coverage pattern analysis
- Anomaly detection

```javascript
const { AnalyticsEngine } = require('./services/analytics-engine');
const digest = await AnalyticsEngine.generateDailyDigest(articles);
```

### `services/ai-training-export.js` 🤖
Generates datasets for AI/ML training.

**Export formats:**
- Instruction tuning pairs
- Q&A datasets
- Sentiment classification
- Entity extraction (NER)
- Embedding datasets
- Time series data

```javascript
const { AIExporter } = require('./services/ai-training-export');
const datasets = await AIExporter.generateAllDatasets(articles);
```

---

## Archive Structure

```
archive/
  v2/
    articles/           # JSONL files, one per month
      2026-01.jsonl     # All articles from January 2026
    market/             # Market data snapshots
      2026-01.jsonl     # Hourly price/sentiment data
    onchain/            # On-chain data  
      2026-01.jsonl     # Bitcoin, DEX, bridge activity
    social/             # Social signals
      2026-01.jsonl     # X/Twitter sentiment & trends
    predictions/        # Prediction market data
      2026-01.jsonl     # Polymarket, Manifold snapshots
    snapshots/          # Complete hourly snapshots
      2026/01/11/
        08.json         # 8am full snapshot
    index/              # Fast lookups
      by-source.json
      by-ticker.json
      by-date.json
    meta/
      schema.json
      stats.json
    reliability/        # Source performance
      stats.json
```

## Article Schema (v2.0.0)

Each article in the JSONL files:

```json
{
  "id": "a1b2c3d4e5f6g7h8",
  "schema_version": "2.0.0",
  "title": "Article headline",
  "link": "https://original-url",
  "canonical_link": "https://normalized-url",
  "description": "Article lede/summary",
  "source": "CoinDesk",
  "source_key": "coindesk",
  "category": "bitcoin",
  "pub_date": "2026-01-08T18:05:00.000Z",
  "first_seen": "2026-01-08T18:10:00.000Z",
  "last_seen": "2026-01-08T23:05:00.000Z",
  "fetch_count": 5,
  "tickers": ["BTC", "ETH"],
  "entities": {
    "people": ["Vitalik Buterin"],
    "companies": ["BlackRock"],
    "protocols": ["Ethereum"]
  },
  "tags": ["institutional", "regulation"],
  "sentiment": {
    "score": 0.65,
    "label": "positive",
    "confidence": 0.85
  },
  "market_context": {
    "btc_price": 94500,
    "eth_price": 3200,
    "fear_greed_index": 65
  },
  "content_hash": "h8g7f6e5d4c3b2a1",
  "meta": {
    "word_count": 23,
    "has_numbers": true,
    "is_breaking": false,
    "is_opinion": false
  }
}
```

## GitHub Action

The archive is collected hourly via `.github/workflows/archive-v2.yml`:

- Runs at minute 5 of every hour
- Can be triggered manually via workflow_dispatch
- Uses enhanced collector with all intelligence services
- Commits changes to the archive directory

**GitHub Secrets to configure:**
| Secret | Required | Description |
|--------|----------|-------------|
| `X_AUTH_TOKEN` | Optional | X/Twitter session cookie for social signals |

## Feature Flags

Control which services run via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `FEATURE_MARKET` | `true` | CoinGecko + DeFiLlama market data |
| `FEATURE_ONCHAIN` | `true` | Bitcoin, DEX, bridge tracking |
| `FEATURE_SOCIAL` | `true` | X/Twitter signals (requires X_AUTH_TOKEN) |
| `FEATURE_PREDICTIONS` | `true` | Polymarket + Manifold markets |
| `FEATURE_CLUSTERING` | `true` | Story grouping |
| `FEATURE_RELIABILITY` | `true` | Source performance tracking |

## Adding New Entity Types

Edit `enrich.js` and add to the relevant array:
- `KNOWN_TICKERS` - Cryptocurrency symbols
- `NAME_TO_TICKER` - Full name → ticker mapping
- `KNOWN_PEOPLE` - Crypto personalities
- `KNOWN_COMPANIES` - Companies and organizations
- `KNOWN_PROTOCOLS` - Blockchain protocols and dApps
- `TAG_PATTERNS` - Regex patterns for content tagging

## Query Examples

Using the API:

```bash
# Get articles mentioning BTC
curl "https://free-crypto-news.vercel.app/api/archive/v2?ticker=BTC"

# Get positive sentiment articles
curl "https://free-crypto-news.vercel.app/api/archive/v2?sentiment=positive"

# Search by keyword
curl "https://free-crypto-news.vercel.app/api/archive/v2?q=ETF"

# Get trending tickers
curl "https://free-crypto-news.vercel.app/api/archive/v2?trending=true"

# Get archive stats
curl "https://free-crypto-news.vercel.app/api/archive/v2?stats=true"
```

Using the raw files:

```bash
# Count articles
wc -l archive/v2/articles/2026-01.jsonl

# Find BTC articles
grep '"BTC"' archive/v2/articles/2026-01.jsonl | jq .title

# Get all negative sentiment articles
jq -c 'select(.sentiment.label == "negative")' archive/v2/articles/2026-01.jsonl
```

## License

MIT
