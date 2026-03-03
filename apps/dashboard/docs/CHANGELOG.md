# Changelog

All notable changes to Crypto Data Aggregator will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Auto-sync available:** Run `npm run changelog:sync` to check for missing commits or 
> `npm run changelog:update` to auto-update this file.

---

## [Unreleased]

### Added

- **Unified Storage Layer** (`src/lib/storage.ts`) - `e74c734`
  - Abstraction layer for Upstash Redis with memory fallback
  - Edge-compatible REST API for Redis operations
  - Support for all Redis data types (strings, hashes, sets, lists)
  - Namespace pattern for data isolation

- **x402 Payment Persistence** - Full integration with storage layer
  - Payment receipts stored persistently
  - Access passes with expiration tracking
  - Payment analytics and statistics

- **Alert Email Integration** - Complete email notification system
  - Price alert emails with proper interfaces
  - News/keyword alert emails
  - Digest email summaries

- **Changelog Automation Scripts** (`scripts/changelog/`)
  - `changelog-generator.js` - Generate changelog from git history
  - `sync-changelog.js` - Compare changelog with git commits
  - Multiple output formats (Markdown, JSON, HTML)
  - Statistics and coverage reporting

### Fixed

- Fixed 35+ TypeScript compilation errors across API routes
- Fixed `useAuth.ts` → `useAuth.tsx` for JSX support
- Fixed email/route.ts interface mismatches with email.ts
- Fixed exchanges/route.ts function signature errors
- Fixed auth.ts type narrowing issues (null vs undefined)

---

## [1.1.0] - 2026-01-24

### Added

- **Complete Mock Data Elimination** - `e74c734`, `9aac946`
  - Full real API integrations replacing all mock/fake data
  - Persistent storage for x402 payments, passes, and receipts
  - Newsletter subscriptions with storage layer
  - Push notification subscriptions with storage

- **Swagger UI Documentation** (`/docs/swagger`) - `d0a5ce9`
  - Interactive API documentation with "Try it out" functionality
  - Dark theme styling matching app design
  - API key persistence in localStorage
  - OpenAPI 3.1 specification at `/api/v2/openapi.json`

- **Rate Limiting for API v2** - `d0a5ce9`
  - Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
  - Configurable limits per endpoint
  - Graceful 429 responses with retry information

- **SEO Enhancements** - `d0a5ce9`
  - JSON-LD structured data in layout for WebApplication, WebAPI, FAQPage schemas
  - Enhanced sitemap with MCP and AI discovery files
  - Schema.org structured data at `/schema.json`

- **MCP Server Discovery Files** - `d0a5ce9`
  - `/.well-known/mcp.json` - MCP server configuration
  - `/.well-known/security.txt` - Security policy
  - `/.well-known/attribution.txt` - Data source credits
  - `/humans.txt` - Human-readable credits
  - `CITATION.cff` - Academic citation file
  - `.github/FUNDING.yml` - GitHub sponsorship

- **Premium UI Component Library** (`src/components/ui/`)
  - `Button` - 7 variants (primary, secondary, ghost, outline, danger, success, glass)
  - `Card` - 6 variants (default, elevated, glass, gradient, interactive, outline)
  - `Badge` - Price change, rank, status, and chain badges
  - `Input` - Search input, number input, textarea
  - `Avatar` - With AvatarGroup for stacking
  - `Tooltip` - Customizable positioning
  - `Progress` - Linear and circular variants
  - `Skeleton` - Content placeholder
  - `Divider` - Gradient and glow variants

- **Upstash Redis REST API Support**
  - Edge-compatible Redis caching via REST API
  - Automatic fallback to memory cache
  - Support for both traditional Redis and Upstash

- **Design Token Migration** - 15+ coin page components migrated
  - CoinConverter, CoinHeader, CoinInfo, CoinNews
  - DeveloperStats, HistoricalTable, MarketStats, MarketsTable
  - Digest page, Sources page, Topic page, FeaturedArticle, ReaderContent

- **Archive Runner Script** - `737a00d`
  - Local scheduler for archive collection without GitHub Actions
  - `npm run archive` - Single collection run
  - `npm run archive:watch` - Continuous hourly collection
  - `npm run archive:daemon` - Background daemon mode
  - `npm run archive:status` - View archive statistics
  - `npm run archive:stop` - Stop background daemon
  - Configurable intervals via `--interval` flag or `ARCHIVE_INTERVAL` env var
  - Full logging to `archive/v2/meta/runner.log`
  - PID file management for daemon mode
  - Graceful shutdown handling

- **Archive Documentation** (`docs/ARCHIVE.md`) - `737a00d`
  - Complete guide to the V1 and V2 archive systems
  - Collection script usage and configuration
  - Intelligence services documentation
  - Cron and systemd integration examples
  - Troubleshooting guide

- **Component Integration** - `4f1203f`, `294a330`
  - All previously unused components now integrated
  - Orphaned features linked to main navigation
  - Complete feature discoverability

- **New Market Features** - `ff38de4`
  - Bitcoin Halving Countdown widget
  - Market Mood Ring visualization
  - Volatility Analysis dashboard

- **Complete Multi-Source Data Integration** - `c39a903`
  - **CryptoCompare** (`src/lib/cryptocompare.ts`): 600+ lines
    - Historical OHLCV data (daily/hourly/minute intervals)
    - Social stats (Twitter followers, Reddit subscribers, GitHub activity)
    - Real-time and full price data
    - Top coins by volume and market cap
    - News aggregation
    - Blockchain data (latest/historical)
  - **Messari** (`src/lib/messari.ts`): 700+ lines
    - Asset profiles and fundamentals
    - Market metrics (ROI, developer activity, mining stats)
    - Asset markets and exchanges
    - Sector classification
    - Research news feed
    - Global market metrics
  - **Coinglass** (`src/lib/coinglass.ts`): 600+ lines
    - Open interest (aggregated and by symbol)
    - Funding rates and averages
    - Liquidation data and summaries
    - Long/short ratios (global and by account)
    - Options data
    - Exchange derivatives info
    - Market sentiment analysis
  - **Etherscan Multi-Chain** (`src/lib/etherscan.ts`): 700+ lines
    - Support for 7 EVM chains (Ethereum, Base, Arbitrum, Polygon, Optimism, BSC, Avalanche)
    - Gas oracle with safe/standard/fast prices
    - ETH price and supply stats
    - Wallet balances and transactions
    - Token transfers and contract verification
    - Network statistics and gas comparison

- **5 New API Routes** - RESTful endpoints for all new data sources
  - `/api/market/cryptocompare` - 11 actions (price, history, news, blockchain, etc.)
  - `/api/market/messari` - 11 actions (assets, metrics, profile, sectors, etc.)
  - `/api/market/coinglass` - 9 actions (openinterest, funding, liquidations, etc.)
  - `/api/market/etherscan` - 12 actions (gas, price, supply, wallet, etc.)
  - `/api/market/aggregated` - 6 types (overview, prices, derivatives, onchain, fundamental, full)

- **30+ React Hooks** (`src/hooks/data-sources.ts`): 800+ lines
  - CryptoCompare hooks: `useCryptoComparePrice`, `useCryptoCompareTopVolume`, `useCryptoCompareHistory`, `useCryptoCompareNews`, `useCryptoCompareBlockchain`
  - Messari hooks: `useMessariGlobal`, `useMessariAssets`, `useMessariAsset`, `useMessariProfile`, `useMessariMetrics`, `useMessariComprehensive`, `useMessariNews`, `useMessariSectors`
  - Coinglass hooks: `useCoinglassOverview`, `useCoinglassOpenInterest`, `useCoinglassFunding`, `useCoinglassLiquidations`, `useCoinglassLongShort`, `useCoinglassGlobalLongShort`, `useCoinglassSymbol`, `useCoinglassExchanges`
  - Etherscan hooks: `useEtherscanStats`, `useMultiChainGas`, `useGasComparison`, `useEthereumGas`, `useEthereumPrice`, `useWalletData`
  - Aggregated hooks: `useAggregatedOverview`, `useAggregatedPrices`, `useAggregatedDerivatives`, `useAggregatedOnchain`, `useAggregatedFundamental`, `useAggregatedFull`
  - Utility hooks: `useFormattedNumber`, `useFormattedPercentage`, `useDataSourceHealth`

- **6 New UI Components** - Production-ready data visualization
  - `DerivativesDashboard` - Liquidations, L/S ratios, open interest tables
  - `MultiChainGasTracker` - Gas prices across 7 EVM chains
  - `FundamentalDataCard` - Messari fundamentals with ROI, supply, markets
  - `AggregatedMarketOverview` - Multi-source global market data
  - `PriceHistoryChart` - SVG price charts with timeframe selection
  - `CryptoNewsAggregator` - Combined news from CryptoCompare and Messari

- **Environment Configuration** - Updated `.env.example` with new API keys
  - CRYPTOCOMPARE_API_KEY
  - MESSARI_API_KEY
  - COINGLASS_API_KEY
  - ETHERSCAN_API_KEY, BASESCAN_API_KEY, ARBISCAN_API_KEY
  - POLYGONSCAN_API_KEY, OPTIMISTIC_ETHERSCAN_API_KEY
  - BSCSCAN_API_KEY, SNOWTRACE_API_KEY

- **Unified Navigation** - `48c1718`
  - CMC-inspired theme implementation
  - Consistent navigation across all pages

- **13 New Free Data Sources** - `c39a903`, `a1769fa`
  - CryptoCompare: Historical OHLCV data, social stats (Twitter, Reddit, GitHub)
  - Blockchain.com: Bitcoin on-chain stats, block height, network difficulty
  - Messari: Research data, asset metrics (FREE tier: 20 requests/minute)
  - CoinGlass: Funding rates, open interest across exchanges
  - GoPlus Labs: Token security analysis (honeypot detection, tax check, trust score)
  - Etherscan: Gas oracle, ETH supply stats (FREE tier: 5 calls/sec)
  - Token Unlocks: Vesting schedule data for upcoming token unlocks
- **additional-sources.ts** - New utility library with typed helper functions
  - `getHistoricalOHLCV()` - Fetch historical price data with configurable intervals
  - `getSocialStats()` - Get Twitter/Reddit/GitHub metrics for coins
  - `getBitcoinStats()` - Bitcoin network stats (hashrate, difficulty, fees)
  - `getFundingRates()` - Perpetual futures funding rates by exchange
  - `getOpenInterest()` - Futures open interest aggregated across exchanges
  - `getTokenSecurity()` - Honeypot/scam detection with calculated trust score
  - `getEthGasOracle()` - Real-time Ethereum gas prices (safe, standard, fast)
  - `getUpcomingUnlocks()` - Token vesting unlock schedules
- **MarketMoodRing Component** - `ff38de4`
  - Gradient-filled rings with pulsing glow effects
  - 5 mood states: Extreme Fear, Fear, Neutral, Greed, Extreme Greed
  - Interactive hover states with detailed tooltips
  - Multiple size variants (sm, md, lg, xl)
  - Full accessibility support with ARIA labels
  - Companion components: `MarketMoodBadge`, `MarketMoodSparkline`
- **MarketMoodWidget** - Ready-to-use widget with real-time data
  - Full, compact, and minimal variants
  - Auto-refresh functionality
  - Sidebar and header variants included
- **useMarketMood Hook** - Real-time Fear & Greed Index data fetching
  - Auto-refresh every 5 minutes
  - Response caching to reduce API calls
  - 7-day historical data support
  - Helper functions: `getMoodColor()`, `getMoodLabel()`
- Comprehensive documentation overhaul
- JSDoc comments for all library functions
- TESTING.md guide for Vitest setup
- COMPONENTS.md for UI documentation
- PWA.md for Progressive Web App features
- SECURITY.md for security best practices

### Changed

- **Design Token Migration (Complete)** - `acaf150`, `718a5b1`, `0e1538a`
  - Migrated all components from hardcoded colors to centralized design tokens
  - Data visualization components: charts.tsx, coin-charts, Screener, MarketStats,
    SentimentDashboard, CorrelationMatrix, DominanceChart, GasTracker, LiquidationsFeed, PriceWidget
  - All 16 loading.tsx skeleton files
  - Error boundary components
  - Utility components: Skeletons, LoadingSpinner, ErrorBoundary, ExportData, KeyboardShortcuts,
    PriceAlerts
  - Portfolio and watchlist components
  - Replaced `dark:` prefix patterns with semantic tokens
  - Charts now use `chartColors` from `src/lib/colors.ts` for Recharts compatibility

---

## [1.0.1] - 2026-01-23

### Added

- **x402 Payment Protocol Integration** - `1acc947`, `7e20882`
  - Full micropayment support via x402 protocol
  - Wallet connection for Ethereum/Base payments
  - Premium tier access via crypto payments
  - Payment verification and receipt generation

- **Tier Upgrade Flow** - `88552b5`
  - Premium tier upgrade with x402 payments
  - Pro and Enterprise tier support
  - Seamless payment experience

- **Dual License Model** - `67f73ba`
  - Free for personal use
  - Commercial license required for business use

- **Pure Black Theme** - `f7f30ca`, `eb73fe2`, `6e8d965`, `b0e1ad3`, `c2547d8`
  - Unified pure black background across all pages
  - Subtle glow effects for component depth
  - White text for maximum contrast and readability

- **Install Page** - `65ff520`
  - Less intrusive PWA install prompt
  - Dedicated `/install` page with instructions

### Fixed

- x402 TypeScript errors - `ce3845d`, `795f0e9`, `65c9e5b`, `8a02bd3`
  - Added missing premium routes and types
  - Added cache export for build compatibility
- Window.ethereum TypeScript narrowing - `e1967fb`
- Dynamic coin price fetching - `e69aaf6`
- Missing x402 exports and groqClient - `88ca40a`

### Documentation

- x402 Payment Protocol Integration Guide - `eb2b71a`

### Maintenance

- Redeployment with X402_PAYMENT_ADDRESS - `9e5f6f6`
- Mainnet configuration - `0926526`
- Updated gitignore patterns - `07c2828`

---

## [1.0.0] - 2026-01-22

### Added

#### Core Features (`77c2795`)

- Real-time cryptocurrency market data from CoinGecko API
- Track 10,000+ cryptocurrencies with live prices
- DeFi protocol analytics with DeFiLlama integration
- Fear & Greed Index sentiment tracking
- Global market statistics dashboard

### Documentation (`8a708ca`)

- Comprehensive README rewrite with detailed feature documentation

### Developer Experience (`d39bca7`)

- Improved contribution workflow
- Enhanced developer tooling

#### Portfolio Management

- Create multiple portfolios
- Add/remove/update holdings
- Real-time portfolio valuation
- Performance tracking with profit/loss calculations
- Portfolio news feed

#### Watchlist

- Create custom watchlists
- Quick add/remove coins
- Organize by custom order
- Persist across sessions (localStorage)

#### Price Alerts

- Price threshold alerts (above/below)
- Percentage change alerts (24h)
- Keyword mention alerts
- Push notification support
- Multiple notification channels

#### Charts & Analytics

- Interactive price charts with Recharts
- Multiple timeframes (24h, 7d, 30d, 1y, max)
- OHLC candlestick charts
- Volume overlay
- Sparkline mini-charts

#### Market Views

- Top coins by market cap
- Trending coins (24h)
- Top gainers and losers
- New listings
- Category browsing
- Exchange listings

#### News & Content

- Aggregated crypto news
- Breaking news highlights
- Category-based filtering
- Article bookmarking
- Read later queue

#### User Experience

- Progressive Web App (PWA)
- Offline support with service worker
- Dark/light/system theme
- Keyboard shortcuts
- Global search (Cmd+K)
- Responsive design (mobile-first)

#### Developer Experience

- TypeScript throughout
- Comprehensive API routes
- Edge Runtime support
- Vitest test suite
- ESLint + Prettier
- Husky pre-commit hooks

### Technical Stack

- Next.js 16 with App Router
- React 19
- TypeScript 5
- Tailwind CSS 4
- SWR for data fetching
- Recharts for visualization
- Framer Motion for animations

---

## Version History Format

### [X.Y.Z] - YYYY-MM-DD

#### Added

- New features

#### Changed

- Changes to existing functionality

#### Deprecated

- Features to be removed in future versions

#### Removed

- Features removed in this version

#### Fixed

- Bug fixes

#### Security

- Security patches

---

## Upgrade Guide

### From 0.x to 1.0.0

This is the initial stable release. If upgrading from a pre-release version:

1. **Clear localStorage** - Data format has changed

   ```javascript
   localStorage.clear();
   ```

2. **Update dependencies**

   ```bash
   npm install
   ```

3. **Rebuild the application**

   ```bash
   npm run build
   ```

4. **Clear service worker cache**
   - Open DevTools → Application → Service Workers
   - Click "Unregister"
   - Reload the page

---

## Links

- [GitHub Releases](https://github.com/nirholas/crypto-data-aggregator/releases)
- [Migration Guides](./MIGRATION.md)
- [Contributing](../CONTRIBUTING.md)
