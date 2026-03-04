# Prompt 01 — Dashboard Core Layout & Design System

## Context

You are working on `crypto-vision`, a cryptocurrency intelligence platform. The dashboard lives in `apps/dashboard/` (Next.js 15, Tailwind CSS, App Router). The current UI is a CoinGecko/CoinMarketCap clone that needs a complete redesign into a professional, dark-themed trading platform UI.

**Keep all existing code** — API integrations, lib modules, SDK, CLI, MCP, services, providers. Only redesign the visual layer.

## Existing Structure

- `apps/dashboard/src/app/layout.tsx` — Root layout
- `apps/dashboard/src/app/globals.css` — Global styles with CSS variables (design tokens already defined)
- `apps/dashboard/src/components/Header.tsx` — Navigation header
- `apps/dashboard/src/components/Footer.tsx` — Footer
- `apps/dashboard/src/components/ui/` — Base UI components
- `apps/dashboard/tailwind.config.js` — Tailwind config

## Task

### 1. Create a New Design System

Replace the CoinGecko aesthetic with a professional trading terminal / Bloomberg-style dark theme:

**Color Palette:**
- Background: `#0a0a0f` (near-black), `#12121a` (card surface), `#1a1a2e` (elevated surface)
- Accent: `#00d4aa` (primary teal/green), `#7b61ff` (secondary purple)
- Gain: `#00d68f`, Loss: `#ff3d71`, Warning: `#ffaa00`
- Text: `#e4e4e7` (primary), `#a1a1aa` (secondary), `#52525b` (muted)
- Border: `rgba(255,255,255,0.06)`

**Typography:**
- Font: Inter for UI, JetBrains Mono for numbers/prices
- Sizes: Tight, information-dense layout

**Components needed:**
- Glass-morphism cards with subtle borders
- Animated number transitions for prices
- Sparkline mini-charts
- Status indicators (pulsing dots)
- Gradient accent borders on active elements
- Skeleton loaders with shimmer effect

### 2. Redesign the Root Layout (`layout.tsx`)

Create a new layout with:
- **Left sidebar** (collapsible, 64px collapsed / 240px expanded):
  - Logo at top
  - Navigation groups: Markets, Trading, Swarm, Portfolio, Research, Admin
  - Active indicator with accent glow
  - Collapse/expand toggle
- **Top bar** (48px):
  - Global search (Cmd+K)
  - Network status indicator
  - Notification bell
  - Wallet connect button (placeholder)
  - Settings gear
- **Main content area** with proper padding and scroll behavior
- No footer (trading terminals don't have footers)

### 3. Redesign `globals.css`

Update CSS variables to match the new palette. Keep the existing design token names but update values:

```css
:root {
  --background: #0a0a0f;
  --surface: #12121a;
  --surface-alt: #1a1a2e;
  --surface-hover: #22223a;
  --surface-border: rgba(255, 255, 255, 0.06);
  --text-primary: #e4e4e7;
  --text-secondary: #a1a1aa;
  --text-muted: #52525b;
  --primary: #00d4aa;
  --primary-hover: #00e4ba;
  --secondary: #7b61ff;
  --gain: #00d68f;
  --loss: #ff3d71;
  --warning: #ffaa00;
}
```

### 4. Create Base UI Components in `components/ui/`

Build these reusable components:
- `Card` — Glass-morphism card with optional glow border
- `Badge` — Status badges (gain/loss/neutral)
- `Table` — Data table with sortable headers, row hover, alternating backgrounds
- `Stat` — KPI stat card with label, value, change indicator
- `Sparkline` — Inline SVG sparkline chart
- `Skeleton` — Shimmer loading skeleton
- `AnimatedNumber` — Price display with color transition on change
- `Sidebar` — Collapsible navigation sidebar
- `TopBar` — Global top bar
- `SearchModal` — Cmd+K search overlay
- `StatusDot` — Pulsing connection status indicator

### 5. Update Header & Navigation

Replace the current `Header.tsx` with the sidebar + top bar pattern. The sidebar should have these navigation items:

```
Markets
  ├── Overview
  ├── Trending
  ├── Gainers/Losers
  ├── Heatmap
  └── Screener

Trading
  ├── Terminal
  ├── Swarm Control
  ├── Bundle Manager
  └── Market Maker

Portfolio
  ├── Holdings
  ├── Watchlist
  └── Alerts

Research
  ├── AI Analysis
  ├── DeFi
  ├── On-Chain
  └── Sentiment

Admin
  ├── API Keys
  ├── Settings
  └── Billing
```

## Constraints

- Do NOT delete any existing lib/ or services/ code
- Do NOT change any API integration logic
- Keep all existing providers (PWA, Theme, Watchlist, etc.)
- All components must be TypeScript strict (no `any`)
- Use Tailwind CSS classes, reference CSS variables via `var(--token-name)`
- Mobile responsive — sidebar collapses to icons on mobile
- Support keyboard navigation throughout
- Every component needs proper loading/error/empty states

## Files to Modify

- `apps/dashboard/src/app/layout.tsx`
- `apps/dashboard/src/app/globals.css`
- `apps/dashboard/tailwind.config.js`
- `apps/dashboard/src/components/Header.tsx`
- `apps/dashboard/src/components/Footer.tsx` (can delete)
- `apps/dashboard/src/components/ui/*.tsx` (create/update)

## Verification

After completing:
1. `cd apps/dashboard && npm run dev` should start without errors
2. The sidebar should render with all navigation groups
3. All existing pages should still be accessible (even if they look unstyled initially)
4. The design system tokens should be applied globally
5. Skeleton loaders should appear while pages load
