# Prompt 04 — Dashboard Portfolio, Watchlist & Alerts

## Context

You are working on `crypto-vision` dashboard (`apps/dashboard/`, Next.js 15). The app already has full implementations for portfolio tracking, watchlist management, and price alerts in the lib layer:

- `apps/dashboard/src/lib/portfolio.ts` — Portfolio tracking with localStorage
- `apps/dashboard/src/lib/watchlist.ts` — Watchlist management
- `apps/dashboard/src/lib/alerts.ts` — Price alert system
- `apps/dashboard/src/components/portfolio/` — Existing portfolio components
- `apps/dashboard/src/components/watchlist/` — Existing watchlist components
- `apps/dashboard/src/components/alerts/` — Alert modal and list components
- Providers: `PortfolioProvider`, `WatchlistProvider`, `AlertsProvider`

## Task

### 1. Redesign Portfolio Page (`/portfolio`)

Replace the existing portfolio page with a professional portfolio tracker:

**Portfolio Summary Header:**
- Total value (large, animated number)
- 24h P&L (absolute + percentage, color-coded)
- All-time P&L
- Best/worst performer badges

**Holdings Table:**
- Columns: Asset (logo + name), Amount, Avg Buy Price, Current Price, Value, P&L ($ + %), Allocation %
- Sortable by any column
- Click row → coin detail page
- Inline sparkline (7d) per row
- Color-coded P&L cells

**Allocation Chart:**
- Donut chart showing portfolio allocation by coin
- Toggle between: by value, by sector, by chain
- "Others" bucket for small holdings

**Performance Chart:**
- Portfolio value over time (line chart)
- Time range: 24h, 7d, 30d, 90d, 1y, All
- Overlay: individual assets vs total
- Benchmark comparison: vs BTC, vs ETH, vs S&P 500

**Transaction History:**
- Add transaction button (buy/sell/transfer)
- Transaction form: coin search, amount, price, date, fee, notes
- Transaction list with filters
- Import from CSV

### 2. Redesign Watchlist Page (`/watchlist`)

**Watchlist Grid:**
- Multiple watchlists (tabs): "Main", "DeFi Picks", "Memes", etc.
- Create/rename/delete watchlist
- Each coin as a compact card OR table row (toggle view)
- Card view: logo, name, price, 24h change, sparkline, volume
- Quick actions: add alert, view coin, remove from watchlist
- Drag to reorder

**Quick Add:**
- Search overlay to add coins (existing global search)
- "Add from Trending" section

**Comparison Mode:**
- Select 2-5 coins from watchlist
- Side-by-side comparison table: price, market cap, volume, supply, 24h/7d/30d change
- Overlaid price chart

### 3. Redesign Alerts Page (`/alerts` or integrate into top bar)

**Alert Creation:**
- Trigger types: Price above/below, % change (24h), Volume spike, Market cap threshold
- Notification channels: In-app, Browser push, Email (placeholder)
- Recurrence: Once, Repeat
- Expiry: optional

**Active Alerts List:**
- Status: Active, Triggered, Expired
- Quick toggle enable/disable
- Edit/delete
- Triggered history with timestamp and price at trigger

**Alert Indicator:**
- Badge count in sidebar and top bar
- Toast notifications when alerts trigger
- Sound option (subtle ping)

### 4. Add Export Functionality

- Export portfolio as CSV/JSON
- Export watchlist as CSV
- Export transaction history as CSV
- Print-friendly portfolio summary

### 5. Connect to Backend API

Wire portfolio and watchlist to the backend API when available:
- `GET /api/portfolio` — Server-side portfolio (future)
- For now, keep localStorage but add a sync mechanism:
  - "Export to Cloud" button that POSTs to backend
  - "Import from Cloud" that GETs from backend
  - LocalStorage as primary, API as backup

## Technical Requirements

- All data persisted in localStorage via existing providers
- Smooth animations on value changes
- Charts using SVG or canvas (no heavy chart libraries unless already installed)
- Skeleton loading states
- Empty state illustrations (text-based, no images)
- Mobile: card layout for tables, bottom sheet for modals
- No `any` types
- Keep existing provider logic, just restyle the UI components

## Files to Modify/Create

- `apps/dashboard/src/app/portfolio/page.tsx` — Redesign
- `apps/dashboard/src/app/watchlist/page.tsx` — Redesign
- `apps/dashboard/src/components/portfolio/*.tsx` — Restyle
- `apps/dashboard/src/components/watchlist/*.tsx` — Restyle
- `apps/dashboard/src/components/alerts/*.tsx` — Restyle
- `apps/dashboard/src/components/charts/DonutChart.tsx` — New
- `apps/dashboard/src/components/charts/PerformanceChart.tsx` — New

## Verification

1. Portfolio page renders with mock/localStorage data
2. Can add/remove coins from watchlist
3. Can create and manage price alerts
4. Charts render correctly (donut, line)
5. Export buttons produce valid CSV/JSON files
6. No TypeScript errors
