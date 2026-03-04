# Prompt 02 — Dashboard Market Data Pages

## Context

You are working on `crypto-vision`, a cryptocurrency intelligence platform. The dashboard is in `apps/dashboard/` (Next.js 15, Tailwind CSS, App Router). The design system from Prompt 01 gives you a dark trading-terminal aesthetic with sidebar navigation.

The backend API runs at `http://localhost:8080` with 200+ endpoints. The dashboard's `src/lib/market-data.ts` already has full CoinGecko integration with caching and rate limiting.

## Existing Code to Keep

- `apps/dashboard/src/lib/market-data.ts` — All market data fetching functions (getTopCoins, getTrending, getGlobalMarketData, getFearGreedIndex, etc.)
- `apps/dashboard/src/lib/analytics.ts` — Correlation, volatility analysis
- `apps/dashboard/src/lib/defi.ts` — DeFi protocol data
- `apps/dashboard/src/app/coin/` — Individual coin pages
- All API integration code in `src/lib/`

## Task

### 1. Redesign the Home Page (`src/app/page.tsx`)

Replace the CoinGecko-style home page with a **trading dashboard overview**:

**Top Row — Global Stats Strip:**
- Total Market Cap (with 24h change %)
- 24h Volume
- BTC Dominance (mini donut chart)
- ETH Gas (gwei, color-coded)
- Fear & Greed Index (gauge visualization)
- All using `AnimatedNumber` component with real data from `getGlobalMarketData()`

**Main Grid (3 columns on desktop):**

Column 1 (wide):
- **Price Ticker Table** — Top 50 coins, compact rows:
  - Rank, Logo, Name/Symbol, Price (animated), 1h/24h/7d change (color-coded), Sparkline (7d), Volume bar, Market cap
  - Sortable headers, click to navigate to `/coin/[id]`
  - Use existing `getTopCoins()` data

Column 2 (medium):
- **Trending Now** — Top 10 trending with mini price charts
- **Top Gainers** — 24h gainers with % badges
- **Top Losers** — 24h losers

Column 3 (narrow):
- **Market Mood** — Fear & Greed gauge (redesigned, not the current widget)
- **BTC Dominance** — Donut chart
- **Gas Tracker** — Multi-chain gas prices
- **Quick Stats** — Active cryptocurrencies, exchanges, total pairs

### 2. Redesign Markets Pages

**`/markets` (Overview):**
- Category tabs: All, DeFi, Layer 1, Layer 2, Meme, AI, Gaming, NFT
- Filter bar: price range, market cap range, volume, chain
- Data table with all coins, paginated (100 per page)
- Use existing `CategoryTabs`, `SearchAndFilters`, `CoinsTable` components but restyle them

**`/trending`:**
- Trending coins grid (card layout, not table)
- Each card: coin logo, name, price, 24h chart, volume spike indicator
- "Most Searched" and "Most Visited" sections

**`/markets/gainers` and `/markets/losers`:**
- Time period toggle: 1h, 24h, 7d, 30d
- Card grid showing top movers with flame/ice indicators

**`/heatmap`:**
- Treemap visualization of market cap (keep existing `Heatmap` component, just restyle)
- Color gradient: deep red → red → neutral → green → deep green based on 24h change
- Hover tooltip with details

**`/screener`:**
- Full-featured screener table with column customization
- Filters: chain, sector, market cap range, volume range, % change range
- Save filter presets
- Export to CSV

### 3. Coin Detail Page (`/coin/[id]/page.tsx`)

Redesign with trading terminal feel:
- **Hero:** Large price with 24h change, animated. High/Low/Volume stats row.
- **Chart:** Full-width TradingView-style chart (use existing chart component or build with canvas/SVG)
  - Time toggles: 1h, 24h, 7d, 30d, 90d, 1y, All
  - Price + Volume overlay
- **Stats Grid:** Market cap, FDV, circulating/total supply, ATH/ATL with dates
- **About:** Description, links, categories, tags
- **Markets Table:** Exchanges listing this coin, with price/volume/spread
- **Related Coins:** Similar by category

### 4. Redesign Existing Components

Restyle these existing components to match the new design system (DON'T delete, modify their JSX/styling):

- `GlobalStatsBar` — Horizontal scrolling stat strip
- `TrendingSection` — Card grid
- `CoinsTable` — Dense data table
- `MarketMoodWidget` — Gauge visualization
- `BreakingNewsTicker` — Scrolling news bar at bottom of page
- `SocialBuzzWidget` — Social sentiment indicators
- `Heatmap` component

### 5. Add Real-Time Price Updates

Create a `useLivePrice` hook in `src/hooks/`:
```typescript
// Connects to backend WebSocket at ws://localhost:8080/ws
// Subscribes to price updates for specified coin IDs
// Returns live price data that components can consume
// Falls back to polling if WS unavailable
```

Wire it into the home page and coin detail pages so prices update without full page refresh.

## Technical Requirements

- All pages server-side rendered with `revalidate = 60`
- Client components only where needed (interactivity, WebSocket)
- Skeleton loading states for every data section
- Error boundaries with retry buttons
- Empty states with helpful messages
- Mobile responsive (table → card layout on mobile)
- No `any` types

## Files to Create/Modify

- `apps/dashboard/src/app/page.tsx` — Home page
- `apps/dashboard/src/app/markets/` — Markets pages
- `apps/dashboard/src/app/trending/page.tsx`
- `apps/dashboard/src/app/heatmap/page.tsx`
- `apps/dashboard/src/app/screener/page.tsx`
- `apps/dashboard/src/app/coin/[id]/page.tsx`
- `apps/dashboard/src/hooks/useLivePrice.ts`
- `apps/dashboard/src/app/markets/components/*.tsx` — Restyle existing

## Verification

1. Home page loads with real market data (may show fallback if rate limited)
2. All market pages navigate correctly from sidebar
3. Coin detail page shows chart, stats, markets
4. Tables are sortable and paginated
5. Mobile layout works (sidebar collapses, tables become cards)
6. No TypeScript errors: `npm run typecheck`
