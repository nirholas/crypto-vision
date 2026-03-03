# Performance Optimization

Strategies and techniques for optimizing Crypto Data Aggregator performance.

---

## Table of Contents

- [Overview](#overview)
- [Core Web Vitals](#core-web-vitals)
- [Bundle Optimization](#bundle-optimization)
- [Rendering Strategies](#rendering-strategies)
- [Caching Strategies](#caching-strategies)
- [Image Optimization](#image-optimization)
- [Network Optimization](#network-optimization)
- [Runtime Performance](#runtime-performance)
- [Monitoring](#monitoring)

---

## Overview

Performance is critical for crypto applications where users need real-time data. Our targets:

| Metric                         | Target  | Current |
| ------------------------------ | ------- | ------- |
| First Contentful Paint (FCP)   | < 1.8s  | ~1.2s   |
| Largest Contentful Paint (LCP) | < 2.5s  | ~2.0s   |
| First Input Delay (FID)        | < 100ms | ~50ms   |
| Cumulative Layout Shift (CLS)  | < 0.1   | ~0.05   |
| Time to Interactive (TTI)      | < 3.8s  | ~3.0s   |

---

## Core Web Vitals

### Largest Contentful Paint (LCP)

**What it measures**: Time until largest visible content renders

**Optimizations applied**:

1. **Preload critical assets**

   ```html
   <link rel="preload" href="/fonts/inter.woff2" as="font" crossorigin />
   ```

2. **Optimize hero images**

   ```tsx
   <Image
     src={heroImage}
     priority // Preload above-fold images
     sizes="(max-width: 768px) 100vw, 50vw"
   />
   ```

3. **Server-side render critical content**
   ```tsx
   // Server Component - renders on server, no JS needed
   export default async function MarketStats() {
     const stats = await getMarketStats();
     return <StatsDisplay data={stats} />;
   }
   ```

### First Input Delay (FID)

**What it measures**: Time from first interaction to response

**Optimizations applied**:

1. **Code splitting** - Load JavaScript on demand

   ```tsx
   const HeavyChart = dynamic(() => import('./HeavyChart'), {
     loading: () => <ChartSkeleton />,
   });
   ```

2. **Defer non-critical scripts**

   ```tsx
   <Script src="/analytics.js" strategy="lazyOnload" />
   ```

3. **Use Web Workers for heavy computation**
   ```typescript
   // Offload price calculations to worker
   const worker = new Worker('/workers/calculations.js');
   worker.postMessage({ prices, holdings });
   ```

### Cumulative Layout Shift (CLS)

**What it measures**: Visual stability during load

**Optimizations applied**:

1. **Reserve space for dynamic content**

   ```tsx
   <div className="h-[400px]">
     {' '}
     {/* Fixed height container */}
     {isLoading ? <Skeleton /> : <Chart data={data} />}
   </div>
   ```

2. **Set dimensions on images**

   ```tsx
   <Image src={coinLogo} width={32} height={32} alt={coinName} />
   ```

3. **Font display strategy**
   ```css
   @font-face {
     font-family: 'Inter';
     font-display: swap; /* Show fallback immediately */
   }
   ```

---

## Bundle Optimization

### Code Splitting

```tsx
// Route-based splitting (automatic with App Router)
// Each page is its own chunk

// Component-based splitting
import dynamic from 'next/dynamic';

const CandlestickChart = dynamic(() => import('@/components/CandlestickChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false, // Client-only component
});

const Heatmap = dynamic(() => import('@/components/Heatmap'), { ssr: false });
```

### Tree Shaking

```typescript
// ✅ Good - only imports used icons
import { TrendingUp, Star, Bell } from 'lucide-react';

// ❌ Bad - imports entire library
import * as Icons from 'lucide-react';
```

### Analyzing Bundle Size

```bash
npm run analyze
```

This generates a visual bundle report showing:

- Chunk sizes
- Dependency weights
- Opportunities for splitting

### External Dependencies

Heavy dependencies are loaded from CDN or split:

```javascript
// next.config.js
module.exports = {
  experimental: {
    optimizePackageImports: ['lucide-react', '@heroicons/react'],
  },
};
```

---

## Rendering Strategies

### Server Components (Default)

```tsx
// Page that fetches data on server
export default async function MarketsPage() {
  // This runs on the server
  const coins = await getTopCoins();

  return (
    <main>
      <h1>Markets</h1>
      <CoinTable coins={coins} />
    </main>
  );
}
```

**Benefits**:

- Zero client JavaScript for static content
- Data fetched at the edge
- SEO-friendly

### Client Components

```tsx
'use client';

export function LivePriceDisplay({ coinId }) {
  // This runs in the browser
  const { data } = useSWR(`/api/price/${coinId}`);

  return <span>{data?.price}</span>;
}
```

**When to use**:

- Interactive features (onClick, onChange)
- Browser APIs (localStorage, WebSocket)
- Real-time updates

### Streaming with Suspense

```tsx
export default function DashboardPage() {
  return (
    <div>
      {/* Renders immediately */}
      <Header />

      {/* Streams when ready */}
      <Suspense fallback={<MarketStatsSkeleton />}>
        <MarketStats />
      </Suspense>

      <Suspense fallback={<CoinTableSkeleton />}>
        <TopCoins />
      </Suspense>
    </div>
  );
}
```

### Static Generation

```tsx
// Generate popular coin pages at build time
export async function generateStaticParams() {
  const topCoins = await getTopCoins(100);
  return topCoins.map((coin) => ({
    coinId: coin.id,
  }));
}

export default async function CoinPage({ params }) {
  const coin = await getCoin(params.coinId);
  return <CoinDetails coin={coin} />;
}
```

---

## Caching Strategies

### Multi-Layer Cache

```
Request → SWR Cache → API Route → Memory Cache → External API
            ↓              ↓             ↓
         (5-60s)      (Headers)      (60-3600s)
```

### Cache Headers

```typescript
// API Route
export async function GET() {
  const data = await getMarketData();

  return new Response(JSON.stringify(data), {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      'CDN-Cache-Control': 'public, max-age=60',
      'Vercel-CDN-Cache-Control': 'public, max-age=60',
    },
  });
}
```

### Stale-While-Revalidate

```typescript
const { data, isValidating } = useSWR('/api/coins', fetcher, {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 5000,
});

// Show stale data immediately while fetching fresh
return (
  <div>
    {data && <CoinList coins={data} />}
    {isValidating && <RefreshIndicator />}
  </div>
);
```

---

## Image Optimization

### Next.js Image Component

```tsx
import Image from 'next/image';

<Image
  src={coin.image}
  alt={coin.name}
  width={32}
  height={32}
  loading="lazy" // Default, below fold
  // priority     // Above fold
/>;
```

### Remote Images

```javascript
// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.coingecko.com',
        pathname: '/coins/images/**',
      },
      {
        protocol: 'https',
        hostname: 'defillama.com',
        pathname: '/icons/**',
      },
    ],
  },
};
```

### Image Formats

Next.js automatically serves:

- WebP for supported browsers
- AVIF for supported browsers (coming)
- Fallback to original format

---

## Network Optimization

### Prefetching

```tsx
// Next.js prefetches linked pages automatically
<Link href="/coin/bitcoin" prefetch>
  Bitcoin
</Link>;

// Manual prefetch
import { useRouter } from 'next/navigation';

const router = useRouter();
router.prefetch('/markets');
```

### DNS Prefetch

```tsx
// In layout.tsx <head>
<link rel="dns-prefetch" href="https://api.coingecko.com" />
<link rel="dns-prefetch" href="https://api.llama.fi" />
```

### Preconnect

```tsx
<link rel="preconnect" href="https://assets.coingecko.com" crossOrigin="" />
```

### Request Deduplication

```typescript
// SWR deduplicates concurrent requests
function Component1() {
  useSWR('/api/coins', fetcher); // Request 1
}

function Component2() {
  useSWR('/api/coins', fetcher); // Same key, reuses Request 1
}
```

---

## Runtime Performance

### Virtualization for Long Lists

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function CoinList({ coins }) {
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: coins.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ height: 600, overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <CoinRow
            key={virtualRow.key}
            coin={coins[virtualRow.index]}
            style={{
              transform: `translateY(${virtualRow.start}px)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

### Memoization

```tsx
// Memoize expensive computations
const sortedCoins = useMemo(() => {
  return [...coins].sort((a, b) => b.market_cap - a.market_cap);
}, [coins]);

// Memoize callbacks to prevent re-renders
const handleSort = useCallback((column: string) => {
  setSortColumn(column);
}, []);

// Memoize components
const MemoizedRow = React.memo(function CoinRow({ coin }) {
  return <tr>...</tr>;
});
```

### Debouncing & Throttling

```typescript
// Debounce search input
const debouncedSearch = useMemo(
  () =>
    debounce((query: string) => {
      setSearchQuery(query);
    }, 300),
  []
);

// Throttle scroll handlers
const throttledScroll = useMemo(
  () =>
    throttle(() => {
      setScrollPosition(window.scrollY);
    }, 100),
  []
);
```

### Web Workers

```typescript
// Offload heavy calculations
// workers/portfolio.worker.ts
self.onmessage = (e) => {
  const { holdings, prices } = e.data;
  const result = calculatePortfolioMetrics(holdings, prices);
  self.postMessage(result);
};

// Component
const worker = useMemo(() => new Worker('/workers/portfolio.worker.js'), []);

useEffect(() => {
  worker.postMessage({ holdings, prices });
  worker.onmessage = (e) => setMetrics(e.data);
}, [holdings, prices]);
```

---

## Monitoring

### Performance Metrics

```typescript
// Track Core Web Vitals
export function reportWebVitals(metric) {
  console.log(metric);

  // Send to analytics
  fetch('/api/analytics', {
    method: 'POST',
    body: JSON.stringify({
      name: metric.name,
      value: metric.value,
      id: metric.id,
    }),
  });
}
```

### Lighthouse CI

```yaml
# .github/workflows/lighthouse.yml
- name: Run Lighthouse
  uses: treosh/lighthouse-ci-action@v10
  with:
    urls: |
      https://crypto-aggregator.vercel.app/
      https://crypto-aggregator.vercel.app/markets
    budgetPath: ./lighthouse-budget.json
```

### Performance Budget

```json
// lighthouse-budget.json
[
  {
    "path": "/*",
    "timings": [
      { "metric": "first-contentful-paint", "budget": 1800 },
      { "metric": "largest-contentful-paint", "budget": 2500 },
      { "metric": "interactive", "budget": 3800 }
    ],
    "resourceSizes": [
      { "resourceType": "script", "budget": 300 },
      { "resourceType": "total", "budget": 500 }
    ]
  }
]
```

---

## Performance Checklist

### Before Deploy

- [ ] Run `npm run build` - check for warnings
- [ ] Run `npm run analyze` - check bundle size
- [ ] Test on slow 3G network
- [ ] Test on low-end device
- [ ] Run Lighthouse audit

### Ongoing

- [ ] Monitor Core Web Vitals
- [ ] Review bundle size on PRs
- [ ] Profile React DevTools
- [ ] Check memory usage
