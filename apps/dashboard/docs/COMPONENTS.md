# Components Guide# Components Reference

- [Tailwind CSS Docs](https://tailwindcss.com/docs)- [Development Guide](./DEVELOPMENT.md)-
  [Architecture](./ARCHITECTURE.md)## Related Documentation---- [ ] Unit tests- [ ] Error state
  handling- [ ] Loading state handling- [ ] Dark mode support- [ ] Responsive design- [ ] Accessible
  (keyboard, screen reader)- [ ] JSDoc documentation- [ ] TypeScript interfaces for props###
  Checklist`ComponentName.displayName = 'ComponentName';});  );    </div>      {propName}    <div className="...">  return (}: ComponentNameProps) {  optional = false,  propName,export const ComponentName = memo(function ComponentName({ */ * <ComponentName propName="value" /> * @example * * Brief component description./**}  optional?: boolean;  /** Optional prop with default */  propName: string;  /** Description of prop */interface ComponentNameProps {import { memo } from 'react';'use client'; // Only if needed */ * @module components/ComponentName * @fileoverview ComponentName - Brief description/**`tsx###
  Template## Creating New Components---- `stagger` - Staggered children- `scale` - Scale 0.9 → 1-
  `slideRight` - Slide from left- `slideLeft` - Slide from right- `slideDown` - Slide from top-
  `slideUp` - Slide from bottom- `fadeIn` - Opacity 0 → 1**Available
  Variants:**`</motion.ul>  ))}    </motion.li>      {item.name}    <motion.li key={item.id} variants={slideUp}>  {items.map(item => (<motion.ul variants={stagger}></motion.div>  Fade in content<motion.div variants={fadeIn} initial="hidden" animate="visible">import { motion } from 'framer-motion';import { fadeIn, slideUp, stagger } from '@/components/FramerAnimations';`tsxPre-built
  Framer Motion animation variants.### FramerAnimations## Animations---| `?` | Show shortcuts help
  || `d` | Toggle dark mode || `g p` | Go to Portfolio || `g w` | Go to Watchlist || `g t` | Go to
  Trending || `g h` | Go to Home || `/` or `Cmd+K` | Open search ||-----|--------|| Key | Action
  |**Shortcuts:**`</KeyboardShortcutsProvider>  <App /><KeyboardShortcutsProvider>import { KeyboardShortcutsProvider } from '@/components/KeyboardShortcuts';`tsxGlobal
  keyboard navigation.###
  KeyboardShortcutsProvider---`} = useAlerts();  toggleAlert,  deleteAlert,  createAlert,  alerts,const { // Usage</AlertsProvider>  <App /><AlertsProvider>import { AlertsProvider, useAlerts } from '@/components/alerts/AlertsProvider';`tsxPrice
  and keyword alert management.###
  AlertsProvider---`} = usePWA();  isUpdateAvailable,  isOnline,  installPrompt,  isInstalled,  isInstallable,const { // Usage</PWAProvider>  <App /><PWAProvider>import { PWAProvider, usePWA } from '@/components/PWAProvider';`tsxProgressive
  Web App features.###
  PWAProvider---`const { bookmarks, addBookmark, removeBookmark, isBookmarked } = useBookmarks();// Usage</BookmarksProvider>  <App /><BookmarksProvider>import { BookmarksProvider, useBookmarks } from '@/components/BookmarksProvider';`tsxManages
  article bookmarks in localStorage.###
  BookmarksProvider---`const { theme, setTheme } = useTheme();import { useTheme } from '@/components/ThemeProvider';`tsx**Hook:**`</ThemeProvider>  <App /><ThemeProvider>import { ThemeProvider } from '@/components/ThemeProvider';`tsxProvides
  theme context (dark/light/system).### ThemeProvider## Providers---**Shows when:** Scrolled > 400px
  from top`<BackToTop />import { BackToTop } from '@/components/BackToTop';`tsxScroll-to-top
  button.###
  BackToTop---`});  duration: 5000,  description: 'With description',  title: 'Custom Toast',toast({// Customtoast.info('New price alert triggered');// Infotoast.error('Failed to load data');// Errortoast.success('Portfolio saved!');// Successimport { toast } from '@/components/Toast';`tsxToast
  notification system.###
  Toast---`</ErrorBoundary>  <RiskyComponent /><ErrorBoundary fallback={<ErrorFallback />}>import { ErrorBoundary } from '@/components/ErrorBoundary';`tsxReact
  error boundary wrapper.###
  ErrorBoundary---`/>  }}    onClick: clearFilters    label: "Clear filters",  action={{  description="Try adjusting your search terms"  title="No results found"  icon={<SearchIcon />}<EmptyStateimport { EmptyState } from '@/components/EmptyState';`tsxEmpty
  state placeholder with action.###
  EmptyState---`<Skeleton className="h-32 w-full rounded-lg" />// Card skeleton<Skeleton className="h-10 w-10 rounded-full" />// Circle skeleton (avatar)<Skeleton className="h-4 w-48" />// Text skeletonimport { Skeleton } from '@/components/Skeleton';`tsxContent
  placeholder for loading states.### Skeleton---**Sizes:** `sm` (16px) | `md` (24px) | `lg` (32px) |
  `xl`
  (48px)`<LoadingSpinner size="md" />import { LoadingSpinner } from '@/components/LoadingSpinner';`tsxAnimated
  loading indicator.### LoadingSpinner## Utility
  Components---`/>  onAddToWatchlist={(id) => addToWatchlist(id)}  showSparkline={true}  coin={coin}<CoinCard import { CoinCard } from '@/components/cards/CoinCard';`tsx###
  Coin
  Cards---`}  category?: string;  publishedAt: string;  source: string;  imageUrl?: string;  url: string;  description?: string;  title: string;  id: string;interface Article {`typescript**Article
  Type:**`<ArticleCardList article={article} />// List view<ArticleCardSmall article={article} />// Compact list<ArticleCardMedium article={article} />// Grid layout<ArticleCardLarge article={article} />// Featured article} from '@/components/cards';  ArticleCardList   ArticleCardSmall,  ArticleCardMedium,  ArticleCardLarge,import { `tsxMultiple
  article card variants for different layouts.### Article Cards##
  Cards---`/>  initialFilters={{ minMarketCap: 1000000000 }}<Screener import { Screener } from '@/components/Screener';`tsxFilterable
  coin screener with sorting.###
  Screener---`/>  metric="price_change_24h"  coins={coins}<Heatmap import { Heatmap } from '@/components/Heatmap';`tsxVisual
  market heatmap by category.###
  Heatmap---`<SentimentDashboard />import { SentimentDashboard } from '@/components/SentimentDashboard';`tsxFear
  & Greed index visualization.### SentimentDashboard---- Active cryptocurrencies- BTC dominance- 24h
  volume- Total market
  cap**Displays:**`<MarketStats />import { MarketStats } from '@/components/MarketStats';`tsxGlobal
  market statistics display.###
  MarketStats---`<PriceTicker coins={['bitcoin', 'ethereum', 'solana']} />import { PriceTicker } from '@/components/PriceTicker';`tsxHorizontal
  scrolling price ticker.### PriceTicker---| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Text size ||
  `showChange` | `boolean` | `true` | Show 24h change || `initialPrice` | `number` | required |
  Initial price to display || `coinId` | `string` | required | CoinGecko coin ID
  ||------|------|---------|-------------|| Prop | Type | Default | Description
  |**Props:**`/>  showChange={true}  initialPrice={50000}  coinId="bitcoin"<LivePrice import { LivePrice } from '@/components/LivePrice';`tsxReal-time
  price display with WebSocket updates.### LivePrice## Feature Components---**Modes:** `light` |
  `dark` |
  `system````<ThemeToggle />import { ThemeToggle } from '@/components/ThemeToggle';```tsxDark/light mode toggle button.### ThemeToggle---- `Esc`- Close-`Enter`- Select result-`↑` `↓`- Navigate results-`/`or`Cmd+K` - Open search**Keyboard Shortcuts:**```<GlobalSearch />import { GlobalSearch } from '@/components/GlobalSearch';```tsxCommand palette-style global search.### GlobalSearch---**Shows on:** Screens < 768px```<MobileNav />import { MobileNav } from '@/components/MobileNav';```tsxBottom navigation bar for mobile devices.### MobileNav---```<Footer />import { Footer } from '@/components/Footer';```tsxSite footer with links and branding.### Footer---- Mobile hamburger menu- Theme toggle- Global search trigger (`/`or`Cmd+K`)- Logo and navigation links**Features:**```<Header />import { Header } from '@/components/Header';```tsxMain navigation header with search and theme toggle.### Header## Core Components---4. **Responsive** - Mobile-first design3. **Accessible** - WCAG 2.1 AA compliant2. **Composition over Props** - Build complex UIs from simple pieces1. **Server Components by Default** - Use `'use
  client'` only when needed### Design
  Principles`└── *.tsx             # Shared/global components├── watchlist/        # Watchlist management UI├── sidebar/          # Sidebar navigation components├── portfolio/        # Portfolio management UI├── coin-charts/      # Chart components for coin pages├── cards/            # Article and coin card variants├── alerts/           # Price & keyword alert componentssrc/components/`##
  Component Architecture---- [Hooks](#hooks)- [Providers](#providers)-
  [Utility Components](#utility-components)- [Feature Components](#feature-components)-
  [Core Components](#core-components)- [Component Architecture](#component-architecture)## Table of
  Contents---UI component documentation for Crypto Data Aggregator. Complete reference for all React
  components in Crypto Data Aggregator.

---

## Table of Contents

- [Layout Components](#layout-components)
- [Navigation Components](#navigation-components)
- [Data Display Components](#data-display-components)
- [Chart Components](#chart-components)
- [Form & Input Components](#form--input-components)
- [Feedback Components](#feedback-components)
- [Provider Components](#provider-components)
- [Utility Components](#utility-components)
- [Animation Components](#animation-components)
- [Custom Hooks](#custom-hooks)
- [Component Patterns](#component-patterns)
- [Best Practices](#best-practices)

---

## Layout Components

### Header

**Location**: `src/components/Header.tsx`

**Purpose**: Main application header with navigation and search

**Features**:

- Logo and app title
- Navigation links
- Global search trigger
- Theme toggle
- Mobile menu toggle

**Props**: None (uses context)

**Usage**:

```tsx
<Header />
```

---

### Footer

**Location**: `src/components/Footer.tsx`

**Purpose**: Application footer with links and attribution

**Usage**:

```tsx
<Footer />
```

---

### MobileNav

**Location**: `src/components/MobileNav.tsx`

**Purpose**: Bottom navigation bar for mobile devices

**Features**:

- Fixed bottom position on mobile
- Icon-based navigation
- Active state indicators
- Hidden on desktop

**Usage**:

```tsx
<MobileNav />
```

---

## Navigation Components

### CommandPalette

**Location**: `src/components/CommandPalette.tsx`

**Purpose**: Quick action modal (Cmd+K / Ctrl+K)

**Features**:

- Fuzzy search for pages and coins
- Keyboard navigation (↑/↓/Enter)
- Recent searches
- Quick actions (theme toggle, etc.)

**Keyboard Shortcuts**: | Key | Action | |-----|--------| | `Cmd+K` / `Ctrl+K` | Open palette | |
`↑` / `↓` | Navigate results | | `Enter` | Select item | | `Escape` | Close palette |

**Usage**:

```tsx
<CommandPalette />
```

---

### GlobalSearch

**Location**: `src/components/GlobalSearch.tsx`

**Purpose**: Search input with autocomplete

**Features**:

- Real-time coin search
- Debounced API calls
- Keyboard navigation
- Recent searches

**Props**:

```typescript
interface GlobalSearchProps {
  placeholder?: string;
  onSelect?: (coin: CoinSearchResult) => void;
  autoFocus?: boolean;
}
```

---

### KeyboardShortcuts

**Location**: `src/components/KeyboardShortcuts.tsx`

**Purpose**: Global keyboard shortcut handler

**Shortcuts Provided**: | Key | Action | |-----|--------| | `g h` | Go to Home | | `g t` | Go to
Trending | | `g w` | Go to Watchlist | | `g p` | Go to Portfolio | | `g d` | Go to DeFi | | `g m` |
Go to Markets | | `d` | Toggle dark mode | | `/` | Focus search | | `?` | Show shortcuts help |

---

## Premium UI Component Library

**Location**: `src/components/ui/`

A comprehensive, design-token-based component library with consistent styling.

### Import

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

### Button

**Variants**: `primary` | `secondary` | `ghost` | `outline` | `danger` | `success` | `glass`
**Sizes**: `sm` | `md` | `lg`

```tsx
<Button variant="primary" size="md">Click me</Button>
<Button variant="glass" leftIcon={<StarIcon />}>Favorite</Button>
<IconButton variant="ghost" icon={<MenuIcon />} label="Menu" />
```

### Card

**Variants**: `default` | `elevated` | `glass` | `gradient` | `interactive` | `outline`

```tsx
<Card variant="elevated">
  <CardHeader title="Market Overview" action={<Button size="sm">View All</Button>} />
  <CardContent>Content here</CardContent>
  <CardFooter>Footer content</CardFooter>
</Card>

<StatCard 
  title="Total Market Cap" 
  value="$3.5T" 
  change={2.5} 
  icon={<ChartIcon />} 
/>
```

### Badge

```tsx
<Badge variant="success">Active</Badge>
<PriceChangeBadge value={5.25} />
<RankBadge rank={1} />
<StatusBadge status="online" />
<ChainBadge chain="ethereum" />
```

### Input

```tsx
<Input placeholder="Enter value" />
<SearchInput placeholder="Search coins..." onSearch={handleSearch} />
<NumberInput value={100} onChange={setValue} min={0} max={1000} />
<Textarea rows={4} placeholder="Description" />
```

### Avatar

```tsx
<Avatar src="/avatar.png" alt="User" size="md" />
<AvatarGroup>
  <Avatar src="/user1.png" alt="User 1" />
  <Avatar src="/user2.png" alt="User 2" />
  <Avatar src="/user3.png" alt="User 3" />
</AvatarGroup>
```

### Progress

```tsx
<Progress value={75} max={100} variant="primary" showLabel />
<CircularProgress value={60} size={48} strokeWidth={4} />
```

### Tooltip

```tsx
<Tooltip content="Helpful information" position="top">
  <Button>Hover me</Button>
</Tooltip>
```

### Divider

```tsx
<Divider />
<Divider variant="gradient" />
<Divider label="OR" />
```

### Skeleton

```tsx
<Skeleton className="h-4 w-32" />
<Skeleton variant="circular" size={40} />
<Skeleton variant="rectangular" height={100} />
```

---

## Data Display Components

### Cards

**Location**: `src/components/cards/`

#### ArticleCardLarge

**Purpose**: Featured news article display

**Props**:

```typescript
interface ArticleCardLargeProps {
  article: Article;
  priority?: boolean;
}
```

#### ArticleCardMedium

**Purpose**: Standard news article card

#### ArticleCardSmall

**Purpose**: Compact news article row

#### CoinCard

**Purpose**: Cryptocurrency summary card

**Props**:

```typescript
interface CoinCardProps {
  coin: CoinData;
  showChange?: '1h' | '24h' | '7d';
  onClick?: () => void;
}
```

---

### Tables

#### CoinTable

**Location**: Inline in market pages

**Features**:

- Sortable columns
- Pagination
- Sparkline charts
- Quick actions (watchlist, alerts)

---

### Skeleton Loaders

**Location**: `src/components/Skeleton.tsx`, `src/components/Skeletons.tsx`

**Purpose**: Loading placeholders

**Components**:

```tsx
<Skeleton className="h-4 w-24" />
<Skeleton className="h-10 w-full rounded-lg" />
<CoinTableSkeleton rows={10} />
<ChartSkeleton />
```

---

### EmptyState

**Location**: `src/components/EmptyState.tsx`, `src/components/EmptyStates.tsx`

**Purpose**: Empty data placeholders

**Props**:

```typescript
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

**Usage**:

```tsx
<EmptyState
  icon={<Star className="w-12 h-12" />}
  title="No coins in watchlist"
  description="Add coins to track their prices"
  action={{
    label: 'Browse coins',
    onClick: () => router.push('/markets'),
  }}
/>
```

---

### LivePrice

**Location**: `src/components/LivePrice.tsx`

**Purpose**: Real-time price display with WebSocket updates

**Props**:

```typescript
interface LivePriceProps {
  coinId: string;
  initialPrice?: number;
  showChange?: boolean;
  className?: string;
}
```

**Features**:

- WebSocket connection for real-time updates
- Flash animation on price change
- Fallback to polling if WebSocket fails

---

### PriceTicker

**Location**: `src/components/PriceTicker.tsx`

**Purpose**: Scrolling price ticker

**Props**:

```typescript
interface PriceTickerProps {
  coins: CoinData[];
  speed?: 'slow' | 'normal' | 'fast';
}
```

---

### MarketMoodRing

**Location**: `src/components/MarketMoodRing.tsx`

**Purpose**: Animated circular gauge displaying Fear & Greed Index with visual effects

**Features**:

- Animated SVG rings with gradient fills
- 5 mood states: Extreme Fear, Fear, Neutral, Greed, Extreme Greed
- Pulsing glow effects based on market intensity
- Interactive hover states with detailed tooltips
- Trend indicator showing change from previous value
- Multiple size variants (sm, md, lg, xl)
- Full accessibility support with ARIA labels

**Props**:

```typescript
interface MarketMoodRingProps {
  value?: number;           // Fear & Greed index (0-100)
  previousValue?: number;   // Previous value for trend
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showDetails?: boolean;    // Show description panel
  animated?: boolean;       // Enable animations
  className?: string;
}
```

**Usage**:

```tsx
import MarketMoodRing, { 
  MarketMoodBadge, 
  MarketMoodSparkline 
} from '@/components/MarketMoodRing';

// Full ring with details
<MarketMoodRing value={42} previousValue={38} size="lg" />

// Compact badge for headers
<MarketMoodBadge value={42} />

// Mini sparkline for history
<MarketMoodSparkline values={[25, 32, 28, 35, 42]} />
```

**Related Hook**: `useMarketMood` - Fetches real-time Fear & Greed data

---

### MarketMoodWidget

**Location**: `src/components/MarketMoodWidget.tsx`

**Purpose**: Complete widget combining MarketMoodRing with real-time data fetching

**Variants**:

| Variant | Description |
|---------|-------------|
| `full` | Complete card with header, ring, sparkline, refresh button |
| `compact` | Badge with sparkline inline |
| `minimal` | Just the badge |

**Props**:

```typescript
interface MarketMoodWidgetProps {
  variant?: 'full' | 'compact' | 'minimal';
  showHistory?: boolean;
  autoRefresh?: boolean;
  className?: string;
}
```

**Usage**:

```tsx
import MarketMoodWidget, { 
  MarketMoodSidebar, 
  MarketMoodHeader 
} from '@/components/MarketMoodWidget';

// Full widget with auto-refresh
<MarketMoodWidget />

// Sidebar-optimized version
<MarketMoodSidebar />

// Ultra-compact header version
<MarketMoodHeader />
```

---

## Chart Components

### Location: `src/components/charts.tsx`, `src/components/coin-charts/`

### PriceChart

**Purpose**: Historical price line/area chart

**Props**:

```typescript
interface PriceChartProps {
  coinId: string;
  days?: number;
  height?: number;
  showVolume?: boolean;
}
```

---

### CandlestickChart

**Purpose**: OHLC candlestick chart

**Props**:

```typescript
interface CandlestickChartProps {
  data: OHLCData[];
  height?: number;
}
```

---

### Heatmap

**Location**: `src/components/Heatmap.tsx`

**Purpose**: Market heatmap visualization

**Features**:

- Size by market cap
- Color by price change
- Clickable cells
- Zoom and pan

---

### Screener

**Location**: `src/components/Screener.tsx`

**Purpose**: Coin screener with filters

**Features**:

- Market cap range filter
- Volume filter
- Price change filter
- ATH distance filter
- Custom column selection

---

## Form & Input Components

### SearchModal

**Location**: `src/components/SearchModal.tsx`

**Purpose**: Full-screen search overlay

**Features**:

- Full-width search input
- Category filters
- Recent searches
- Trending suggestions

---

### ThemeToggle

**Location**: `src/components/ThemeToggle.tsx`

**Purpose**: Dark/light mode toggle button

**Props**:

```typescript
interface ThemeToggleProps {
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}
```

---

## Feedback Components

### Toast

**Location**: `src/components/Toast.tsx`

**Purpose**: Toast notifications

**Props**:

```typescript
interface ToastProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  onClose?: () => void;
}
```

**Usage** (via context):

```tsx
const { showToast } = useToast();
showToast({ type: 'success', message: 'Added to watchlist!' });
```

---

### LoadingSpinner

**Location**: `src/components/LoadingSpinner.tsx`

**Purpose**: Loading indicator

**Props**:

```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
```

---

### ErrorBoundary

**Location**: `src/components/ErrorBoundary.tsx`

**Purpose**: React error boundary

**Props**:

```typescript
interface ErrorBoundaryProps {
  fallback?: React.ReactNode;
  children: React.ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}
```

---

## Provider Components

### ThemeProvider

**Location**: `src/components/ThemeProvider.tsx`

**Purpose**: Dark/light mode context

**Context Value**:

```typescript
interface ThemeContextType {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  resolvedTheme: 'light' | 'dark';
}
```

---

### BookmarksProvider

**Location**: `src/components/BookmarksProvider.tsx`

**Purpose**: News bookmarks context

**Context Value**:

```typescript
interface BookmarksContextType {
  bookmarks: Bookmark[];
  addBookmark: (article: Article) => void;
  removeBookmark: (id: string) => void;
  isBookmarked: (id: string) => boolean;
}
```

---

### AlertsProvider

**Location**: `src/components/alerts/AlertsProvider.tsx`

**Purpose**: Price alerts context

**Context Value**:

```typescript
interface AlertsContextType {
  alerts: PriceAlert[];
  addAlert: (alert: Omit<PriceAlert, 'id' | 'createdAt'>) => void;
  removeAlert: (id: string) => void;
  toggleAlert: (id: string) => void;
  triggeredAlerts: PriceAlert[];
  dismissTriggered: (id: string) => void;
}
```

---

### PWAProvider

**Location**: `src/components/PWAProvider.tsx`

**Purpose**: Progressive Web App features

**Features**:

- Service worker registration
- Install prompt handling
- Update notifications
- Offline detection

---

## Utility Components

### BackToTop

**Location**: `src/components/BackToTop.tsx`

**Purpose**: Scroll to top button

**Features**:

- Shows after scrolling down
- Smooth scroll animation
- Keyboard accessible

---

### InstallPrompt

**Location**: `src/components/InstallPrompt.tsx`

**Purpose**: PWA install prompt

**Features**:

- Detects installability
- Custom install UI
- Dismissible
- Remembers user choice

---

### UpdatePrompt

**Location**: `src/components/UpdatePrompt.tsx`

**Purpose**: Service worker update notification

---

### OfflineIndicator

**Location**: `src/components/OfflineIndicator.tsx`

**Purpose**: Offline status banner

---

### StructuredData

**Location**: `src/components/StructuredData.tsx`

**Purpose**: JSON-LD structured data for SEO

**Props**:

```typescript
interface StructuredDataProps {
  type: 'WebSite' | 'WebPage' | 'Article' | 'BreadcrumbList';
  data: Record<string, unknown>;
}
```

---

## Animation Components

### Location: `src/components/Animations.tsx`, `src/components/FramerAnimations.tsx`

### FadeIn

**Purpose**: Fade in animation wrapper

```tsx
<FadeIn delay={0.2}>
  <Content />
</FadeIn>
```

---

### SlideIn

**Purpose**: Slide in animation wrapper

```tsx
<SlideIn direction="left" delay={0.1}>
  <Sidebar />
</SlideIn>
```

---

### Stagger

**Purpose**: Staggered children animations

```tsx
<Stagger staggerDelay={0.1}>
  {items.map((item) => (
    <Card key={item.id} />
  ))}
</Stagger>
```

---

## Custom Hooks

### useMarketMood

**Location**: `src/hooks/useMarketMood.ts`

**Purpose**: Fetches real-time Fear & Greed Index data from Alternative.me API

**Features**:

- Auto-refresh every 5 minutes
- Response caching to reduce API calls
- 7-day historical data
- Error handling with fallback
- Helper functions for mood colors and labels

**Returns**:

```typescript
interface UseMarketMoodReturn {
  value: number;              // Current index (0-100)
  previousValue?: number;     // Yesterday's value
  history: number[];          // 7-day history (oldest to newest)
  classification: string;     // "Extreme Fear" | "Fear" | "Neutral" | "Greed" | "Extreme Greed"
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}
```

**Usage**:

```tsx
import { useMarketMood, getMoodColor, getMoodLabel } from '@/hooks/useMarketMood';

function SentimentDisplay() {
  const { value, previousValue, history, isLoading, error, refresh } = useMarketMood({
    refreshInterval: 5 * 60 * 1000,  // 5 minutes
    historyDays: 7,
    autoRefresh: true,
  });

  if (isLoading) return <Skeleton />;
  if (error) return <Error message={error} onRetry={refresh} />;

  return (
    <div>
      <span style={{ color: getMoodColor(value) }}>
        {getMoodLabel(value)}: {value}
      </span>
      {previousValue && (
        <span>{value > previousValue ? '↑' : '↓'}</span>
      )}
    </div>
  );
}
```

**Helper Functions**:

```tsx
import { getMoodColor, getMoodLabel } from '@/hooks/useMarketMood';

getMoodColor(25);  // '#f97316' (orange - Fear)
getMoodLabel(25);  // 'Fear'

getMoodColor(75);  // '#22c55e' (green - Greed)
getMoodLabel(75);  // 'Greed'
```

---

## Component Patterns

### Compound Components

```tsx
// Usage
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Body>Content</Card.Body>
  <Card.Footer>Actions</Card.Footer>
</Card>
```

### Render Props

```tsx
<DataFetcher url="/api/coins">
  {({ data, loading, error }) => (loading ? <Skeleton /> : <CoinList coins={data} />)}
</DataFetcher>
```

### Custom Hooks

```tsx
// useCoinData.ts
export function useCoinData(coinId: string) {
  const { data, error, isLoading, mutate } = useSWR(`/api/market/coins/${coinId}`, fetcher);

  return {
    coin: data,
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}
```

---

## Best Practices

### 1. Component Organization

```
components/
├── ComponentName/
│   ├── index.ts          # Public exports
│   ├── ComponentName.tsx # Main component
│   ├── ComponentName.test.tsx
│   └── utils.ts          # Component-specific utils
```

### 2. Props Interface

Always define and export props interfaces:

```typescript
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({ variant = 'primary', ...props }: ButtonProps) {
  // ...
}
```

### 3. Accessibility

- Use semantic HTML elements
- Include ARIA labels where needed
- Ensure keyboard navigation
- Test with screen readers

```tsx
<button aria-label="Add to watchlist" aria-pressed={isWatched} onClick={toggleWatch}>
  <Star aria-hidden="true" />
</button>
```

### 4. Performance

- Use `React.memo` for expensive renders
- Use `useMemo`/`useCallback` appropriately
- Avoid inline object/array creation in JSX
- Lazy load heavy components

```tsx
const MemoizedChart = React.memo(function Chart({ data }) {
  // Expensive render
});

const LazyHeatmap = React.lazy(() => import('./Heatmap'));
```
