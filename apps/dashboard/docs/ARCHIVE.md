# Archive System

The crypto-data-aggregator includes a comprehensive historical data archive system that collects, enriches, and indexes crypto news along with market context.

## Quick Start

```bash
# Run archive collection once
npm run archive

# Run continuously (hourly)
npm run archive:watch

# Run as background daemon
npm run archive:daemon

# Check archive status
npm run archive:status

# Stop background daemon
npm run archive:stop
```

## Architecture

### Archive Versions

#### V1 Archive (`archive/2026/`)
- **Format**: JSON files per day
- **Path**: `archive/YYYY/MM/DD.json`
- **Content**: Raw article data with basic metadata
- **Use case**: Simple historical lookups

#### V2 Archive (`archive/v2/`)
- **Format**: JSONL files per month (more efficient for large datasets)
- **Path**: `archive/v2/articles/YYYY-MM.jsonl`
- **Content**: Enriched articles with sentiment, entities, market context
- **Features**:
  - Market data snapshots
  - On-chain event correlation
  - Social signal tracking
  - Prediction market data
  - Story clustering
  - Source reliability scoring

### Directory Structure

```
archive/
├── index.json              # V1 master index
├── 2026/                   # V1 daily archives
│   └── 01/
│       ├── 08.json
│       ├── 09.json
│       └── ...
└── v2/                     # V2 enhanced archive
    ├── articles/           # Enriched articles (JSONL)
    │   └── 2026-01.jsonl
    ├── market/             # Market data snapshots
    │   └── 2026-01.jsonl
    ├── onchain/            # On-chain events
    │   └── 2026-01.jsonl
    ├── social/             # Social signals
    │   └── 2026-01.jsonl
    ├── predictions/        # Prediction market data
    │   └── 2026-01.jsonl
    ├── snapshots/          # Hourly state snapshots
    │   └── 2026-01-12-21.json
    ├── index/              # Lookup indexes
    │   ├── by-date.json
    │   ├── by-source.json
    │   └── by-ticker.json
    └── meta/
        ├── stats.json      # Archive statistics
        ├── monthly/        # Monthly stats
        ├── schema.json     # Data schema
        └── runner.log      # Collection log
```

## Collection Script

### Basic Usage

```bash
# Single collection run
npm run archive

# With custom API URL
API_URL=https://your-api.com npm run archive

# With custom interval (30 minutes)
npm run archive:watch -- --interval 30
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_URL` | `http://localhost:3000` | News API base URL |
| `ARCHIVE_DIR` | `./archive` | Archive storage directory |
| `ARCHIVE_INTERVAL` | `60` | Minutes between collections |
| `FEATURE_MARKET` | `true` | Collect market data |
| `FEATURE_ONCHAIN` | `true` | Collect on-chain events |
| `FEATURE_SOCIAL` | `true` | Collect social signals |
| `FEATURE_PREDICTIONS` | `true` | Collect prediction markets |
| `FEATURE_CLUSTERING` | `true` | Enable story clustering |
| `FEATURE_RELIABILITY` | `true` | Track source reliability |

### Feature Flags

Enable/disable expensive operations:

```bash
# Minimal collection (articles only)
FEATURE_MARKET=false FEATURE_ONCHAIN=false npm run archive

# Full collection with all features
npm run archive
```

## Intelligence Services

Located in `scripts/archive/services/`:

| Service | Description |
|---------|-------------|
| `market-data.js` | BTC/ETH prices, fear/greed index, DeFi TVL |
| `onchain-events.js` | Whale alerts, gas prices, token transfers |
| `social-signals.js` | Reddit sentiment, trending topics |
| `prediction-markets.js` | Polymarket, Manifold predictions |
| `story-clustering.js` | Groups related articles |
| `source-reliability.js` | Tracks source accuracy |
| `ai-training-export.js` | Exports data for ML training |
| `analytics-engine.js` | Trend analysis and metrics |

## Article Enrichment

Each article is enriched with:

```typescript
interface EnrichedArticle {
  // Core fields
  id: string;
  title: string;
  description: string;
  url: string;
  source_key: string;
  pub_date: string;
  
  // Enrichment
  sentiment: {
    score: number;      // -1 to 1
    label: string;      // bullish/bearish/neutral
    confidence: number;
  };
  tickers: string[];    // ['BTC', 'ETH', ...]
  entities: {
    people: string[];
    organizations: string[];
    protocols: string[];
  };
  
  // Market context at publish time
  market_context: {
    btc_price: number;
    eth_price: number;
    fear_greed_index: number;
    total_market_cap: number;
  };
  
  // Metadata
  first_seen: string;
  last_updated: string;
  fetch_count: number;
}
```

## API Endpoints

### V1 Archive API

```typescript
// Get archive index
GET /api/archive
Response: { dates: string[], total: number }

// Get articles by date
GET /api/archive?date=2026-01-08
Response: Article[]

// Search archive
GET /api/archive?query=bitcoin&from=2026-01-01&to=2026-01-15
Response: { articles: Article[], total: number }
```

### V2 Archive API

```typescript
// Get V2 stats
GET /api/archive/v2/stats
Response: ArchiveV2Stats

// Get monthly articles
GET /api/archive/v2/month/2026-01
Response: EnrichedArticle[]

// Search by ticker
GET /api/archive/v2/search?ticker=BTC&limit=50
Response: { articles: EnrichedArticle[], total: number }

// Get snapshot
GET /api/archive/v2/snapshot/2026-01-12-21
Response: ArchiveSnapshot
```

## Programmatic Usage

### Using the Archive Library

```typescript
import { 
  getArchiveV2Stats,
  getArchiveV2Month,
  queryArchiveV2 
} from '@/lib/archive-v2';

// Get stats
const stats = await getArchiveV2Stats();
console.log(`Total articles: ${stats.total_articles}`);

// Get a month's articles
const articles = await getArchiveV2Month('2026-01');

// Search articles
const results = await queryArchiveV2({
  ticker: 'BTC',
  sentiment: 'bullish',
  fromDate: '2026-01-01',
  limit: 100,
});
```

### Daemon Mode

Run the archiver as a background process:

```bash
# Start daemon
npm run archive:daemon

# Check status
npm run archive:status

# View logs
tail -f archive/v2/meta/runner.log

# Stop daemon
npm run archive:stop
```

## Monitoring

### Status Command

```bash
$ npm run archive:status

📊 Archive Runner Status

  🟢 Daemon running (PID: 12345)

  📁 Archive Stats:
     Total articles: 293
     Sources: 6
     Tickers tracked: 32
     Last fetch: 2026-01-12T21:30:30.762Z

  📈 Latest Market:
     BTC: $91,273
     ETH: $3,096
     Fear/Greed: 27

  📜 Recent log entries:
     [2026-01-12T21:30:00] [INFO] Starting archive collection...
     [2026-01-12T21:30:30] [SUCCESS] Collection completed in 30.2s
```

### Log Files

- **Runner log**: `archive/v2/meta/runner.log`
- **Stats**: `archive/v2/meta/stats.json`
- **Monthly stats**: `archive/v2/meta/monthly/YYYY-MM.json`

## Cron/Systemd Integration

### Using Cron

```bash
# Edit crontab
crontab -e

# Run every hour
0 * * * * cd /path/to/project && npm run archive >> /var/log/archive.log 2>&1

# Run every 30 minutes
*/30 * * * * cd /path/to/project && npm run archive
```

### Using Systemd

Create `/etc/systemd/system/crypto-archive.service`:

```ini
[Unit]
Description=Crypto News Archive Collector
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/crypto-data-aggregator
ExecStart=/usr/bin/node scripts/archive-runner.js --watch
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=API_URL=https://your-api.com

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable crypto-archive
sudo systemctl start crypto-archive

# Check status
sudo systemctl status crypto-archive

# View logs
sudo journalctl -u crypto-archive -f
```

## Best Practices

1. **Start with minimal features**: Disable expensive operations until needed
2. **Use daemon mode for production**: More reliable than manual cron
3. **Monitor disk usage**: JSONL files grow over time
4. **Backup regularly**: Archive data is valuable historical record
5. **Set appropriate intervals**: Hourly is usually sufficient

## Troubleshooting

### Collection fails with "API not reachable"

```bash
# Check if API is running
curl http://localhost:3000/api/health

# Use production API
API_URL=https://free-crypto-news.vercel.app npm run archive
```

### High memory usage

```bash
# Disable expensive features
FEATURE_CLUSTERING=false FEATURE_SOCIAL=false npm run archive
```

### Stale data

```bash
# Check last fetch time
npm run archive:status

# Force a fresh collection
npm run archive
```
