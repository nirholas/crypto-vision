# Design System Migration Guide

## Overview

This document defines the color system for Crypto Data Aggregator. All components use the
centralized design token system.

> **Migration Status: ✅ Complete** (January 2026)
>
> All data visualization components, loading states, coin pages, and core UI have been migrated to design
> tokens. 60+ components now use the semantic color system.

## Recent Migrations (January 2026)

### Coin Page Components
- `CoinConverter` - Currency converter widget
- `CoinHeader` - Coin detail page header
- `CoinInfo` - Links and description section
- `CoinNews` - Related news articles
- `DeveloperStats` - GitHub and community stats
- `HistoricalTable` - OHLCV data table
- `MarketStats` - Market cap, volume, supply
- `MarketsTable` - Exchange trading pairs

### Page Components
- `DigestPage` - AI-powered daily digest
- `SourcesPage` - News sources browser
- `TopicPage` - Topic-filtered news
- `FeaturedArticle` - Hero article component
- `ReaderContent` - Article reader view

## Premium UI Component Library

A new premium component library is available at `@/components/ui`:

```tsx
import { 
  Button, IconButton,
  Card, CardHeader, CardContent, CardFooter, StatCard, FeatureCard,
  Badge, PriceChangeBadge, RankBadge, StatusBadge, ChainBadge,
  Input, SearchInput, NumberInput, Textarea,
  Tooltip, Progress, CircularProgress,
  Divider, Avatar, AvatarGroup, Skeleton
} from '@/components/ui';
```

### Button Variants
- `primary` - Blue brand button with glow
- `secondary` - Surface background with border
- `ghost` - Transparent with hover state
- `outline` - Primary border with transparent bg
- `danger` - Red destructive action
- `success` - Green positive action
- `glass` - Glassmorphism effect

### Card Variants
- `default` - Standard surface card
- `elevated` - Raised with larger shadow
- `glass` - Glassmorphism effect
- `gradient` - Top gradient accent bar
- `interactive` - Click/tap feedback
- `outline` - Border only

### Premium CSS Classes
New utility classes available in globals.css:
- `.glass-card` - Premium glassmorphism
- `.glass-modal` - Frosted glass for modals
- `.gradient-border` - Animated gradient border
- `.glow-primary` / `.glow-gain` / `.glow-loss` - Glow effects
- `.btn-glow` / `.btn-shine` - Button effects
- `.card-elevated` / `.card-gradient` - Card styles
- `.live-pulse` - Live indicator animation
- `.price-flash-up` / `.price-flash-down` - Price change flash
- `.badge-glow` / `.badge-gradient` - Badge styles
- `.table-premium` - Enhanced table styling
- `.input-premium` / `.search-premium` - Form inputs
- `.section-header` - Section title with accent
- `.divider-gradient` / `.divider-glow` - Divider styles
- `.number-mono` / `.number-display` - Number formatting
- `.progress-bar` / `.progress-bar-animated` - Progress indicators

## Source of Truth

1. **CSS Variables** - `src/app/globals.css` (`:root` block)
2. **TypeScript Tokens** - `src/lib/colors.ts`
3. **Tailwind Config** - `tailwind.config.js` (references CSS vars)

## Migration Mapping

### Background Colors

| Old Pattern      | New Pattern               | Notes                      |
| ---------------- | ------------------------- | -------------------------- |
| `bg-black`       | `bg-background`           | Main app background        |
| `bg-white`       | `bg-surface`              | Cards, modals (dark theme) |
| `dark:bg-black`  | _(remove)_                | Not needed, use semantic   |
| `dark:bg-white`  | _(remove)_                | Not needed                 |
| `bg-gray-900`    | `bg-background-secondary` |                            |
| `bg-gray-800`    | `bg-surface`              |                            |
| `bg-gray-700`    | `bg-surface-hover`        |                            |
| `bg-gray-100`    | `bg-surface`              | Light bg → surface         |
| `bg-gray-50`     | `bg-surface`              | Light bg → surface         |
| `bg-neutral-900` | `bg-background-secondary` |                            |
| `bg-neutral-800` | `bg-surface`              |                            |
| `bg-slate-900`   | `bg-background-secondary` |                            |
| `bg-slate-800`   | `bg-surface`              |                            |

### Text Colors

| Old Pattern      | New Pattern           | Notes               |
| ---------------- | --------------------- | ------------------- |
| `text-white`     | `text-text-primary`   | Or keep for buttons |
| `text-gray-900`  | `text-text-primary`   |                     |
| `text-gray-700`  | `text-text-secondary` |                     |
| `text-gray-600`  | `text-text-secondary` |                     |
| `text-gray-500`  | `text-text-muted`     |                     |
| `text-gray-400`  | `text-text-muted`     |                     |
| `text-gray-300`  | `text-text-secondary` |                     |
| `text-neutral-*` | Use `text-text-*`     |                     |
| `text-slate-*`   | Use `text-text-*`     |                     |

### Border Colors

| Old Pattern        | New Pattern             |
| ------------------ | ----------------------- |
| `border-gray-700`  | `border-surface-border` |
| `border-gray-800`  | `border-surface-border` |
| `border-gray-200`  | `border-surface-border` |
| `border-gray-100`  | `border-surface-border` |
| `border-neutral-*` | `border-surface-border` |
| `border-slate-*`   | `border-surface-border` |

### Semantic Colors

| Old Pattern        | New Pattern    |
| ------------------ | -------------- |
| `text-green-500`   | `text-gain`    |
| `text-green-400`   | `text-gain`    |
| `text-emerald-500` | `text-gain`    |
| `text-red-500`     | `text-loss`    |
| `text-red-400`     | `text-loss`    |
| `bg-green-*`       | `bg-gain-bg`   |
| `bg-red-*`         | `bg-loss-bg`   |
| `text-amber-*`     | `text-warning` |
| `text-orange-*`    | `text-warning` |
| `text-blue-500`    | `text-primary` |

### Hover States

| Old Pattern           | New Pattern              |
| --------------------- | ------------------------ |
| `hover:bg-gray-100`   | `hover:bg-surface-hover` |
| `hover:bg-gray-700`   | `hover:bg-surface-hover` |
| `hover:bg-gray-800`   | `hover:bg-surface-hover` |
| `dark:hover:bg-black` | `hover:bg-surface-hover` |

## Dark Mode Patterns to Remove

Since we're always in dark mode, remove these patterns:

- `dark:bg-*` → Use the dark value directly
- `dark:text-*` → Use the dark value directly
- `dark:border-*` → Use the dark value directly

## Chart Colors (Hex Values)

For libraries like Recharts that don't support CSS variables:

```typescript
import { chartColors, colors } from '@/lib/colors';

// Use chartColors for Recharts
<Line stroke={chartColors.gain} />
<Bar fill={chartColors.loss} />

// Or individual colors
<Area stroke={colors.primary} />
```

## Component Pattern Examples

### Card

```tsx
// Before
<div className="bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-700">

// After
<div className="bg-surface rounded-xl border border-surface-border">
```

### Button

```tsx
// Before
<button className="bg-blue-500 hover:bg-blue-600 text-white">

// After
<button className="bg-primary hover:bg-primary-hover text-white">
```

### Text

```tsx
// Before
<p className="text-gray-600 dark:text-gray-400">
<span className="text-gray-500 dark:text-gray-500">

// After
<p className="text-text-secondary">
<span className="text-text-muted">
```

### Price Change

```tsx
// Before
<span className={value > 0 ? 'text-green-500' : 'text-red-500'}>

// After
import { getPriceClass } from '@/lib/colors';
<span className={getPriceClass(value)}>

// Or
<span className={value > 0 ? 'text-gain' : 'text-loss'}>
```

## Validation

After migration, run:

```bash
npm run lint
npm run typecheck
npm run build
```

Check for:

- No `bg-white` or `bg-black` patterns (except overlays)
- No `text-gray-*` or `bg-gray-*` patterns
- No `dark:` prefixes (except for specific overrides)
- All colors using design tokens

## Migrated Components

The following components have been fully migrated to use design tokens:

### Data Visualization

- `charts.tsx` - Uses `chartColors` from colors.ts
- `coin-charts/index.tsx` - Price, volume, and mini charts
- `Screener.tsx` - Filter panels and table
- `MarketStats.tsx` - Market overview cards
- `SentimentDashboard.tsx` - Gauges and sentiment cards
- `CorrelationMatrix.tsx` - Correlation heatmap
- `DominanceChart.tsx` - Donut and bar charts
- `GasTracker.tsx` - Gas price cards
- `LiquidationsFeed.tsx` - Liquidation list
- `PriceWidget.tsx` - Compact price display
- `MarketMoodRing.tsx` - Fear & Greed circular gauge (NEW)
- `MarketMoodWidget.tsx` - Complete sentiment widget (NEW)

### Loading States

- All 16 `loading.tsx` files in `/src/app/`
- `LoadingSpinner.tsx` variants
- `Skeletons.tsx` components

### Core Components

- `ErrorBoundary.tsx`
- `ExportData.tsx`
- `KeyboardShortcuts.tsx`
- `PriceAlerts.tsx`
- `SocialBuzz.tsx`

### Portfolio & Watchlist

- `portfolio/AddHoldingModal.tsx`
- `portfolio/HoldingsTable.tsx`
- `portfolio/PortfolioSummary.tsx`
- `watchlist/WatchlistMiniWidget.tsx`
- `watchlist/WatchlistExport.tsx`

### Custom Hooks

- `useMarketMood.ts` - Fear & Greed Index data fetching with helper functions (NEW)
