# Features Guide

Complete guide to all Free Crypto News features and tools.

## News & Content

### 📰 News Feed

The main news aggregator with real-time updates from 200+ sources.

**URL:** `/`

**Features:**
- Real-time news from 200+ professional sources
- Category filtering (DeFi, Bitcoin, Ethereum, NFT, etc.)
- Source filtering
- Sentiment indicators
- Breaking news highlights
- Infinite scroll with lazy loading

### 🔍 Search

Full-text search across all news articles.

**URL:** `/search`

**Features:**
- Keyword search
- Date range filtering
- Source filtering
- Category filtering
- Saved searches

### 📖 Article Reader

Distraction-free article reading experience.

**URL:** `/read/[slug]` or `/article/[id]`

**Features:**
- Clean reading mode
- AI-powered summary
- Related articles
- Share options
- Text-to-speech

### 📚 Topics

Browse news by topic and trending subjects.

**URL:** `/topics`, `/topic/[name]`

**Features:**
- Trending topics
- Topic-specific feeds
- Related topics
- Historical topic data

### 🏷️ Categories

Browse by content category.

**URL:** `/category/[name]`

**Categories:**
- DeFi
- Bitcoin
- Ethereum
- NFT
- Layer 2
- Regulation
- Trading
- Research
- And more...

---

## Market Data

### 📊 Markets

Live cryptocurrency market data.

**URL:** `/markets`

**Features:**
- Top 100 cryptocurrencies
- Price, volume, market cap
- 24h/7d/30d changes
- Sparkline charts
- Sorting and filtering

### 🔥 Trending

Trending cryptocurrencies and topics.

**URL:** `/trending`

**Features:**
- Trending coins
- Search trends
- Social trends
- Volume leaders

### 📈 Movers

Top gainers and losers.

**URL:** `/movers`

**Features:**
- Top gainers (24h/7d/30d)
- Top losers
- Volume leaders
- New listings

### 🌡️ Heatmap

Visual market heatmap.

**URL:** `/heatmap`

**Features:**
- Color-coded performance
- Sector groupings
- Multiple timeframes
- Interactive zoom

### 🥧 Dominance

Market dominance charts.

**URL:** `/dominance`

**Features:**
- Bitcoin dominance
- Ethereum dominance
- Stablecoin share
- Historical trends

### ⛽ Gas Tracker

Ethereum gas price tracker.

**URL:** `/gas`

**Features:**
- Current gas prices (slow/standard/fast)
- Gas price history
- Optimal transaction timing
- Cost estimates

---

## Trading Tools

### 💱 Arbitrage

Cross-exchange arbitrage opportunities.

**URL:** `/arbitrage`

**Features:**
- Real-time price differences
- Exchange pairs
- Profit calculator
- Alert setup

### 📊 Funding Rates

Perpetual futures funding rates.

**URL:** `/funding`

**Features:**
- Current funding rates
- Predicted rates
- Historical rates
- Exchange comparison

### 📉 Liquidations

Liquidation data across exchanges.

**URL:** `/liquidations`

**Features:**
- Real-time liquidations
- Liquidation heatmap
- Historical data
- Alert setup

### 📖 Order Book

Aggregated order book data.

**URL:** `/orderbook`

**Features:**
- Multi-exchange aggregation
- Depth visualization
- Large order detection
- Bid/ask spread

### 📈 Signals

AI-generated trading signals.

**URL:** `/signals`

**Features:**
- Buy/sell signals
- Technical indicators
- Confidence scores
- Backtested results

### ⚙️ Options

Crypto options market data.

**URL:** `/options`

**Features:**
- Options chain
- Open interest
- Implied volatility
- Max pain calculation

### 🔙 Backtesting

Strategy backtesting tool.

**URL:** `/backtest`

**Features:**
- Historical simulation
- Performance metrics
- Drawdown analysis
- Custom strategies

---

## Analytics & Research

### 📊 Analytics

Platform analytics and statistics.

**URL:** `/analytics`

**Features:**
- Article statistics
- Source performance
- Category breakdown
- Time distribution

### 📉 Correlation

Asset correlation analysis.

**URL:** `/correlation`

**Features:**
- Correlation matrix
- Rolling correlations
- Cross-asset analysis
- Crypto vs TradFi

### 🔮 Predictions

AI-powered price predictions.

**URL:** `/predictions`

**Features:**
- Price forecasts
- Confidence intervals
- Multiple timeframes
- Model explanations

### 📊 Screener

Advanced cryptocurrency screener.

**URL:** `/screener`

**Features:**
- Custom filters
- Technical indicators
- Fundamental metrics
- Saved screens

### 😨 Fear & Greed

Market sentiment index.

**URL:** `/fear-greed`

**Features:**
- Current index value
- Historical chart
- Component breakdown
- Interpretation guide

### 💬 Sentiment

News sentiment analysis.

**URL:** `/sentiment`

**Features:**
- Article sentiment scores
- Aggregate sentiment
- Sentiment trends
- Asset-specific sentiment

---

## On-Chain Data

### ⛓️ On-Chain

On-chain analytics dashboard.

**URL:** `/onchain`

**Features:**
- Active addresses
- Transaction volume
- Exchange flows
- Holder distribution

### 🐋 Whales

Whale transaction tracking.

**URL:** `/whales`

**Features:**
- Large transactions
- Whale wallet tracking
- Exchange inflows/outflows
- Historical patterns

### 🏥 Protocol Health

DeFi protocol health metrics.

**URL:** `/protocol-health`

**Features:**
- TVL tracking
- Smart contract risk
- Audit status
- Historical health

### 🔮 Oracle

Price oracle data.

**URL:** `/oracle`

**Features:**
- Chainlink prices
- Oracle deviations
- Update frequency
- Data freshness

---

## AI Features

### 🤖 AI Agent

Conversational AI assistant.

**URL:** `/ai-agent`

**Features:**
- Natural language queries
- Market analysis
- News summarization
- Custom research

### 📝 Digest

AI-generated news digest.

**URL:** `/digest`

**Features:**
- Daily summaries
- Key highlights
- Trend analysis
- Customizable topics

### � AI Intelligence Suite

Advanced AI-powered market intelligence.

**Endpoints:** `/api/ai/*`

**Features:**

| Feature | Endpoint | Description |
|---------|----------|-------------|
| **News Synthesis** | `/api/ai/synthesize` | Auto-clusters duplicate articles into comprehensive summaries |
| **Trending Explainer** | `/api/ai/explain` | AI explains why topics are trending with full context |
| **Portfolio News** | `/api/ai/portfolio-news` | Scores news relevance to your holdings |
| **News-Price Correlation** | `/api/ai/correlation` | Detects news-to-price correlations |
| **Flash Briefing** | `/api/ai/flash-briefing` | Ultra-short summaries for voice assistants |
| **Narrative Tracker** | `/api/ai/narratives` | Tracks narratives through lifecycle phases |
| **Cross-Lingual** | `/api/ai/cross-lingual` | Regional sentiment divergence detection |
| **Source Quality** | `/api/ai/source-quality` | Source scoring and clickbait detection |
| **Research Agent** | `/api/ai/research` | Deep-dive research reports |

### �🧮 Calculator

Crypto calculators.

**URL:** `/calculator`

**Features:**
- Profit calculator
- DCA calculator
- Mining calculator
- Staking calculator

---

## Research & Analysis

### 📜 Regulatory

Regulatory news tracker.

**URL:** `/regulatory`

**Features:**
- Global regulation news
- Country-specific tracking
- Regulatory calendar
- Impact analysis

### 🎙️ Influencers

Crypto influencer tracking.

**URL:** `/influencers`

**Features:**
- Top influencers
- Prediction accuracy
- Sentiment analysis
- Social reach

### 📰 Narratives

Market narrative tracking.

**URL:** `/narratives`

**Features:**
- Current narratives
- Narrative strength
- Related assets
- Historical trends

### 🏢 Entities

Entity mention tracking.

**URL:** `/entities`

**Features:**
- Named entities
- Mention frequency
- Entity relationships
- Sentiment by entity

### 📊 Coverage Gap

News coverage analysis.

**URL:** `/coverage-gap`

**Features:**
- Underreported events
- Coverage comparison
- Source blind spots
- Gap alerts

### ✅ Claims

Claim verification.

**URL:** `/claims`

**Features:**
- Claim extraction
- Verification status
- Source tracking
- Fact-checking

### 🎣 Clickbait

Clickbait detection.

**URL:** `/clickbait`

**Features:**
- Clickbait scores
- Headline analysis
- Quality indicators
- Source rankings

### 📍 Origins

News origin tracking.

**URL:** `/origins`

**Features:**
- Original source detection
- Syndication tracking
- Citation analysis
- Breaking news attribution

### ✅ Fact Check

Fact-checking tool.

**URL:** `/factcheck`

**Features:**
- Claim verification
- Source credibility
- Historical accuracy
- Community input

### 📚 Citations

Academic citation tracker.

**URL:** `/citations`

**Features:**
- Research papers
- Citation counts
- Author tracking
- Topic relevance

---

## Portfolio & User Features

### 💼 Portfolio

Portfolio tracking.

**URL:** `/portfolio`

**Features:**
- Multi-wallet support
- Performance tracking
- Asset allocation
- P&L calculation

### 👀 Watchlist

Cryptocurrency watchlist.

**URL:** `/watchlist`

**Features:**
- Custom lists
- Price alerts
- Quick actions
- Sync across devices

### 🔖 Bookmarks

Saved articles.

**URL:** `/bookmarks`

**Features:**
- Save articles
- Organize by folder
- Search saved
- Export bookmarks

### 💾 Saved

Saved items.

**URL:** `/saved`

**Features:**
- Saved articles
- Saved searches
- Saved filters
- Quick access

---

## Coin Pages

### 🪙 Coin Detail

Individual cryptocurrency pages.

**URL:** `/coin/[id]`

**Features:**
- Price chart
- Market data
- News feed
- On-chain data
- Social sentiment

### 🔄 Compare

Cryptocurrency comparison.

**URL:** `/compare`

**Features:**
- Side-by-side comparison
- Multiple metrics
- Visual charts
- Export data

---

## Developer Tools

### 👨‍💻 Developers

Developer portal.

**URL:** `/developers`

**Features:**
- API documentation
- SDK downloads
- Code examples
- API key management

### 📊 Charts

Embeddable chart tools.

**URL:** `/charts`

**Features:**
- TradingView integration
- Custom indicators
- Multiple timeframes
- Share/embed

---

## Social & Community

### 📣 Buzz

Social buzz tracking.

**URL:** `/buzz`

**Features:**
- Social mentions
- Trending topics
- Sentiment analysis
- Platform comparison

---

## Utility Pages

### ⚙️ Settings

User settings.

**URL:** `/settings`

**Features:**
- Theme selection
- Language preference
- Notification settings
- Data export

### 📲 Install

PWA installation guide.

**URL:** `/install`

**Features:**
- Installation instructions
- Platform guides
- Offline support info

### 📖 About

About the project.

**URL:** `/about`

**Features:**
- Project information
- Team
- Open source links

---

## Related Documentation

- [API Reference](./API.md) - All API endpoints
- [User Guide](./USER-GUIDE.md) - Getting started
- [Developer Guide](./DEVELOPER-GUIDE.md) - Building & contributing
