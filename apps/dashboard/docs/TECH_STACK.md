# Technology Stack

Detailed documentation of all technologies, libraries, and tools used in Crypto Data Aggregator.

---

## Table of Contents

- [Core Framework](#core-framework)
- [Frontend Technologies](#frontend-technologies)
- [Styling & UI](#styling--ui)
- [Data Fetching & State](#data-fetching--state)
- [Charts & Visualization](#charts--visualization)
- [Testing](#testing)
- [Developer Tools](#developer-tools)
- [Build & Deployment](#build--deployment)
- [External APIs](#external-apis)
- [Version Matrix](#version-matrix)

---

## Core Framework

### Next.js 16

**Purpose**: React framework for production-grade applications

**Why Next.js?**

- **App Router** - Modern file-based routing with React Server Components
- **Edge Runtime** - API routes run at the edge for low latency
- **Built-in Optimization** - Automatic image, font, and script optimization
- **Zero Config** - Works out of the box with sensible defaults

**Key Features Used**:

```typescript
// Server Components (default in app/)
export default async function Page() {
  const data = await fetchData(); // Runs on server
  return <div>{data}</div>;
}

// Client Components
'use client';
export function InteractiveChart() {
  const [zoom, setZoom] = useState(1);
  // Runs in browser
}

// API Routes with Edge Runtime
export const runtime = 'edge';
export async function GET(request: Request) {
  // Runs at edge locations worldwide
}
```

**Configuration**: [next.config.js](../next.config.js)

- Compression enabled
- Security headers (HSTS, XSS Protection, etc.)
- Image domains configured for CoinGecko/DeFiLlama
- Bundle analyzer integration

---

### React 19

**Purpose**: UI component library

**Key Features Used**:

- **Server Components** - Reduce client bundle, fetch data on server
- **Suspense** - Loading states with `<Suspense fallback={...}>`
- **Concurrent Features** - Non-blocking updates for smooth UX
- **Hooks** - `useState`, `useEffect`, `useMemo`, `useCallback`, `useContext`

**Patterns**:

```typescript
// Context for global state
const ThemeContext = createContext<ThemeContextType>(null);

// Custom hooks for reusable logic
function useCoinPrice(coinId: string) {
  return useSWR(`/api/market/coins/${coinId}`, fetcher);
}

// Memoization for performance
const sortedCoins = useMemo(() => coins.sort((a, b) => b.market_cap - a.market_cap), [coins]);
```

---

### TypeScript 5.0

**Purpose**: Static type checking for JavaScript

**Why TypeScript?**

- **Type Safety** - Catch errors at compile time
- **IntelliSense** - Better IDE autocomplete
- **Refactoring** - Safe large-scale code changes
- **Documentation** - Types serve as living documentation

**Key Patterns**:

```typescript
// Interface definitions
interface CoinData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  price_change_percentage_24h: number;
}

// Generic components
interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
}

// Type guards
function isCoinData(data: unknown): data is CoinData {
  return typeof data === 'object' && data !== null && 'id' in data;
}

// Utility types
type PartialCoin = Partial<CoinData>;
type CoinKeys = keyof CoinData;
```

**Configuration**: [tsconfig.json](../tsconfig.json)

---

## Frontend Technologies

### Framer Motion 12

**Purpose**: Production-ready animation library

**Why Framer Motion?**

- **Declarative API** - Simple syntax for complex animations
- **Gesture Support** - Drag, hover, tap interactions
- **Layout Animations** - Smooth transitions on layout changes
- **Exit Animations** - Animate components on unmount

**Usage Examples**:

```typescript
import { motion, AnimatePresence } from 'framer-motion';

// Basic animation
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  Content
</motion.div>

// List animations with stagger
<motion.ul>
  {items.map((item, i) => (
    <motion.li
      key={item.id}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.1 }}
    />
  ))}
</motion.ul>

// Exit animations
<AnimatePresence>
  {isVisible && (
    <motion.div
      exit={{ opacity: 0, scale: 0.9 }}
    />
  )}
</AnimatePresence>
```

---

### Lucide React & Heroicons

**Purpose**: Icon libraries

**Lucide React** (`lucide-react`):

- 1000+ icons
- Tree-shakeable
- Customizable stroke width

**Heroicons** (`@heroicons/react`):

- By Tailwind team
- Outline and solid variants
- 24px and 20px sizes

```typescript
import { TrendingUp, Star, Bell } from 'lucide-react';
import { ArrowUpIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';

<TrendingUp className="w-5 h-5 text-green-500" />
<StarIcon className="w-4 h-4 fill-yellow-400" />
```

---

## Styling & UI

### Tailwind CSS 4

**Purpose**: Utility-first CSS framework

**Why Tailwind?**

- **Rapid Development** - Build UIs without leaving HTML/JSX
- **Consistency** - Design tokens ensure visual consistency
- **Performance** - Only ships used styles (tree-shaking)
- **Dark Mode** - Built-in dark mode with `dark:` prefix

**Key Features**:

```typescript
// Responsive design
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">

// Dark mode
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">

// Hover/focus states
<button className="hover:bg-blue-600 focus:ring-2 focus:ring-blue-500">

// Animations
<div className="animate-pulse transition-all duration-300">

// Custom utilities
<div className="price-positive price-negative">
```

**Configuration**: [tailwind.config.js](../tailwind.config.js)

- Custom color palette
- Extended animations
- Custom utilities for crypto-specific styling

---

### PostCSS

**Purpose**: CSS transformation tool

**Plugins Used**:

- `@tailwindcss/postcss` - Tailwind CSS processing
- Autoprefixer (via Tailwind)

**Configuration**: [postcss.config.js](../postcss.config.js)

---

## Data Fetching & State

### SWR 2.3

**Purpose**: React hooks for data fetching with caching

**Why SWR?**

- **Stale-While-Revalidate** - Show cached data while fetching fresh
- **Automatic Revalidation** - Refetch on focus, reconnect, interval
- **Deduplication** - Multiple components share same request
- **Optimistic Updates** - Instant UI updates before server confirms

**Usage Patterns**:

```typescript
import useSWR from 'swr';

// Basic fetching
const fetcher = (url: string) => fetch(url).then(r => r.json());

function CoinPrice({ coinId }: { coinId: string }) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/market/coins/${coinId}`,
    fetcher,
    {
      refreshInterval: 30000,      // Refresh every 30s
      revalidateOnFocus: true,     // Refresh on window focus
      dedupingInterval: 5000,      // Dedupe requests within 5s
    }
  );

  if (isLoading) return <Skeleton />;
  if (error) return <Error />;
  return <Price value={data.price} />;
}

// Conditional fetching
const { data } = useSWR(
  coinId ? `/api/coins/${coinId}` : null,  // null = don't fetch
  fetcher
);

// Mutate (update) cache
await mutate('/api/portfolio', newData, { revalidate: false });
```

---

### LocalStorage

**Purpose**: Client-side persistent storage

**Used For**:

- Portfolio holdings
- Watchlists
- Price alerts
- Theme preference
- Recently viewed coins

**Patterns**:

```typescript
// Custom hook for localStorage with SSR safety
function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
```

---

## Charts & Visualization

### Recharts 2.15

**Purpose**: Composable charting library for React

**Why Recharts?**

- **Declarative** - Charts as React components
- **Composable** - Mix and match chart elements
- **Responsive** - Built-in responsive containers
- **Customizable** - Full control over styling

**Chart Types Used**:

```typescript
import {
  LineChart, Line, AreaChart, Area,
  BarChart, Bar, PieChart, Pie,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';

// Price chart
<ResponsiveContainer width="100%" height={400}>
  <AreaChart data={priceHistory}>
    <defs>
      <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
      </linearGradient>
    </defs>
    <XAxis dataKey="date" />
    <YAxis domain={['auto', 'auto']} />
    <Tooltip content={<CustomTooltip />} />
    <Area
      type="monotone"
      dataKey="price"
      stroke="#10B981"
      fill="url(#gradient)"
    />
  </AreaChart>
</ResponsiveContainer>

// OHLC Candlestick (custom implementation)
<CandlestickChart data={ohlcData} />

// Portfolio allocation pie
<PieChart>
  <Pie
    data={allocations}
    dataKey="value"
    nameKey="coin"
    innerRadius={60}
    outerRadius={80}
  />
</PieChart>
```

---

## Testing

### Vitest 4.0

**Purpose**: Fast unit test framework

**Why Vitest?**

- **Vite-Powered** - Instant hot module replacement
- **Jest Compatible** - Same API, easy migration
- **TypeScript Native** - No configuration needed
- **UI Mode** - Visual test explorer

**Configuration**: [vitest.config.ts](../vitest.config.ts)

**Usage**:

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('formatPrice', () => {
  it('formats USD correctly', () => {
    expect(formatPrice(1234.56)).toBe('$1,234.56');
  });

  it('handles small decimals', () => {
    expect(formatPrice(0.00001234)).toBe('$0.00001234');
  });
});

// Mocking
vi.mock('./api', () => ({
  fetchCoin: vi.fn().mockResolvedValue({ price: 50000 }),
}));

// Async testing
it('fetches coin data', async () => {
  const data = await fetchCoin('bitcoin');
  expect(data.price).toBeGreaterThan(0);
});
```

---

### Testing Library

**Purpose**: DOM testing utilities

**Packages**:

- `@testing-library/react` - React component testing
- `@testing-library/dom` - DOM queries
- `@testing-library/jest-dom` - Custom matchers

**Usage**:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { CoinCard } from './CoinCard';

describe('CoinCard', () => {
  it('displays coin information', () => {
    render(<CoinCard coin={mockCoin} />);

    expect(screen.getByText('Bitcoin')).toBeInTheDocument();
    expect(screen.getByText('$50,000')).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const onClick = vi.fn();
    render(<CoinCard coin={mockCoin} onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith('bitcoin');
  });
});
```

---

## Developer Tools

### ESLint 9

**Purpose**: JavaScript/TypeScript linter

**Plugins**:

- `@typescript-eslint` - TypeScript-specific rules
- `eslint-config-next` - Next.js recommended rules
- `eslint-plugin-jsx-a11y` - Accessibility rules

**Configuration**: [eslint.config.mjs](../eslint.config.mjs)

---

### Prettier 3.8

**Purpose**: Code formatter

**Configuration**: [.prettierrc](../.prettierrc)

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

---

### Husky 9

**Purpose**: Git hooks manager

**Hooks Configured**:

- `pre-commit`: Run lint-staged + TypeScript check

**Configuration**: [.husky/](../.husky/)

---

### lint-staged 16

**Purpose**: Run linters on staged files only

**Configuration** (in package.json):

```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml}": ["prettier --write"]
  }
}
```

---

## Build & Deployment

### Build Process

```bash
npm run build
```

**Steps**:

1. TypeScript compilation
2. Next.js optimization
3. Static page generation
4. API route bundling
5. Asset optimization

**Output**:

- `.next/` - Build artifacts
- `.next/static/` - Static assets (CSS, JS, images)
- `.next/server/` - Server-side code

---

### Bundle Analysis

```bash
npm run analyze
```

Uses `@next/bundle-analyzer` to visualize:

- Client bundle composition
- Server bundle composition
- Tree-shaking effectiveness

---

## External APIs

### CoinGecko API (Free)

**Purpose**: Cryptocurrency market data

**Endpoints Used**: | Endpoint | Purpose | Cache TTL | |----------|---------|-----------| |
`/coins/markets` | Top coins by market cap | 60s | | `/coins/{id}` | Detailed coin info | 120s | |
`/coins/{id}/market_chart` | Historical prices | 300s | | `/coins/{id}/ohlc` | OHLC candlestick data
| 300s | | `/search/trending` | Trending coins | 300s | | `/coins/categories` | Category list |
3600s | | `/exchanges` | Exchange list | 600s |

**Rate Limits**: ~50 calls/minute (free tier)

---

### DeFiLlama API (Free)

**Purpose**: DeFi protocol data

**Endpoints Used**: | Endpoint | Purpose | Cache TTL | |----------|---------|-----------| |
`/protocols` | All DeFi protocols | 300s | | `/chains` | Blockchain TVL | 300s | |
`/protocol/{name}` | Protocol details | 300s |

**Rate Limits**: Generous, no API key required

---

### Alternative.me API (Free)

**Purpose**: Fear & Greed Index

**Endpoints Used**: | Endpoint | Purpose | Cache TTL | |----------|---------|-----------| | `/fng/`
| Current sentiment | 3600s | | `/fng/?limit=30` | Historical sentiment | 3600s |

---

## Version Matrix

| Technology   | Version | Release Date | EOL      |
| ------------ | ------- | ------------ | -------- |
| Node.js      | 18+     | Apr 2022     | Apr 2025 |
| Next.js      | 16      | 2025         | Active   |
| React        | 19      | 2024         | Active   |
| TypeScript   | 5.0+    | Mar 2023     | Active   |
| Tailwind CSS | 4.0     | 2024         | Active   |

---

## Upgrade Path

### Checking for Updates

```bash
# Check outdated packages
npm outdated

# Update all (minor/patch)
npm update

# Update major versions (careful!)
npx npm-check-updates -u
npm install
```

### Key Upgrade Considerations

1. **Next.js**: Check migration guide at nextjs.org
2. **React**: Usually backwards compatible
3. **Tailwind**: May require config updates
4. **TypeScript**: Check breaking changes

---

## Further Reading

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [SWR Documentation](https://swr.vercel.app)
- [Vitest Documentation](https://vitest.dev)
- [CoinGecko API Docs](https://www.coingecko.com/api/documentation)
- [DeFiLlama API Docs](https://defillama.com/docs/api)
