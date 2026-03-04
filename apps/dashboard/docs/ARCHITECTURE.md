# Architecture

System design and data flow for Crypto Data Aggregator.

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Data Flow](#data-flow)
- [Component Architecture](#component-architecture)
- [Caching Strategy](#caching-strategy)
- [API Layer](#api-layer)
- [State Management](#state-management)
- [File Structure](#file-structure)

---

## Overview

Crypto Data Aggregator is a Next.js application that aggregates cryptocurrency market data from
multiple sources. It uses the App Router for routing and server-side rendering, with Edge Runtime
for API routes.

### Key Design Principles

1. **Edge-First** - API routes run on Edge Runtime for low latency
2. **Cache-Heavy** - Multi-layer caching reduces API calls
3. **Progressive Enhancement** - Works without JavaScript, enhanced with it
4. **Zero API Keys Required** - Free tier APIs only (CoinGecko, DeFiLlama)

---

## System Architecture

```mermaid
flowchart TB
    subgraph Client["Browser"]
        UI[React Components]
        SWR[SWR Cache]
        LS[LocalStorage]
    end

    subgraph NextJS["Next.js App"]
        subgraph Pages["App Router"]
            SSR[Server Components]
            CSR[Client Components]
        end

        subgraph API["API Routes (Edge)"]
            Market["/api/market/*"]
            DeFi["/api/defi"]
            Sentiment["/api/sentiment"]
            Portfolio["/api/portfolio"]
        end

        subgraph Lib["Library Layer"]
            MarketData[market-data.ts]
            Cache[cache.ts]
            Alerts[alerts.ts]
            PortfolioLib[portfolio.ts]
        end
    end

    subgraph External["External APIs"]
        CoinGecko[(CoinGecko API)]
        DeFiLlama[(DeFiLlama API)]
        AlternativeMe[(Alternative.me)]
    end

    UI --> SWR
    SWR --> API
    UI --> LS
    SSR --> Lib
    API --> Lib
    Lib --> Cache
    MarketData --> CoinGecko
    MarketData --> DeFiLlama
    MarketData --> AlternativeMe
```

---

## Data Flow

### Market Data Flow

```mermaid
sequenceDiagram
    participant U as User
    participant C as Component
    participant S as SWR
    participant A as API Route
    participant L as Lib/market-data
    participant M as Memory Cache
    participant E as External API

    U->>C: View Page
    C->>S: useSWR('/api/market/coins')

    alt Cache Hit (SWR)
        S-->>C: Return cached data
    else Cache Miss
        S->>A: GET /api/market/coins
        A->>L: getTopCoins()

        alt Memory Cache Hit
            L->>M: getCached('top-coins')
            M-->>L: Cached data
        else Memory Cache Miss
            L->>E: fetch(coingecko.com/...)
            E-->>L: Market data
            L->>M: setCache('top-coins', data)
        end

        L-->>A: TokenPrice[]
        A-->>S: JSON Response
        S-->>C: Update UI
    end

    C-->>U: Render coins table
```

### Price Alert Flow

```mermaid
sequenceDiagram
    participant U as User
    participant C as AlertModal
    participant P as AlertsProvider
    participant L as LocalStorage
    participant A as API
    participant W as WebSocket

    U->>C: Create Alert
    C->>P: addAlert(alert)
    P->>L: Save to localStorage

    loop Every 30s
        P->>A: Check prices
        A-->>P: Current prices
        P->>P: Evaluate conditions

        alt Alert Triggered
            P->>U: Show notification
            P->>L: Mark as triggered
        end
    end

    Note over W: Alternative: WebSocket
    W-->>P: Real-time price update
    P->>P: Evaluate immediately
```

### Portfolio Calculation Flow

```mermaid
flowchart LR
    subgraph Input
        H[Holdings<br/>coinId, amount, avgPrice]
    end

    subgraph Fetch
        P[Current Prices<br/>getTopCoins]
    end

    subgraph Calculate
        V[Value = amount × price]
        PL[P&L = value - cost]
        A[Allocation = value / total]
    end

    subgraph Output
        R[PortfolioValue<br/>totalValue, holdings[]]
    end

    H --> V
    P --> V
    V --> PL
    V --> A
    PL --> R
    A --> R
```

---

## Component Architecture

### Page Structure

```mermaid
flowchart TB
    subgraph Layout["RootLayout"]
        Header
        ThemeProvider
        AlertsProvider

        subgraph Page["Page Component"]
            SSC[Server Component<br/>Initial Data]
            CSC[Client Component<br/>Interactive UI]
        end

        Footer
    end

    Header --> Page
    Page --> Footer
    ThemeProvider --> Page
    AlertsProvider --> CSC
```

### Component Hierarchy

```
app/
├── layout.tsx              # Root layout with providers
├── page.tsx                # Home/Markets dashboard
│
├── coin/[coinId]/
│   └── page.tsx            # Coin detail page
│       ├── CoinHeader      # Price, name, stats
│       ├── PriceChart      # Interactive chart
│       ├── MarketStats     # Market data table
│       └── TradingPairs    # Ticker list
│
├── portfolio/
│   └── page.tsx
│       ├── PortfolioSummary
│       ├── HoldingsList
│       └── AddHoldingModal
│
└── defi/
    └── page.tsx
        ├── ProtocolTable
        └── ChainBreakdown
```

---

## Caching Strategy

### Multi-Layer Cache

```mermaid
flowchart LR
    subgraph L1["L1: SWR (Client)"]
        SWR[In-memory<br/>30s-5min]
    end

    subgraph L2["L2: Memory (Server)"]
        MC[MemoryCache<br/>30s-1hr]
    end

    subgraph L3["L3: Next.js"]
        NC[fetch cache<br/>revalidate: 60]
    end

    subgraph L4["L4: CDN"]
        CDN[Vercel Edge<br/>s-maxage]
    end

    Client --> L1
    L1 --> L2
    L2 --> L3
    L3 --> L4
    L4 --> API[External API]
```

### Cache TTL Configuration

| Data Type           | Client (SWR) | Server (Memory) | CDN   |
| ------------------- | ------------ | --------------- | ----- |
| Live Prices         | 30s          | 30s             | 60s   |
| Historical (1d)     | 1min         | 60s             | 2min  |
| Historical (7d)     | 5min         | 5min            | 10min |
| Historical (30d)    | 15min        | 15min           | 30min |
| Static (categories) | 1hr          | 1hr             | 2hr   |

### Stale-While-Revalidate

```mermaid
stateDiagram-v2
    [*] --> Fresh: Cache set
    Fresh --> Stale: TTL × 0.8 elapsed
    Stale --> Revalidating: Request received
    Revalidating --> Fresh: Background fetch complete
    Stale --> Expired: TTL × 2 elapsed
    Expired --> Fresh: New fetch
```

---

## API Layer

### Route Structure

```
src/app/api/
├── market/
│   ├── coins/route.ts          # GET: Coin list
│   ├── snapshot/[coinId]/      # GET: Coin details
│   ├── history/[coinId]/       # GET: Historical data
│   ├── ohlc/[coinId]/          # GET: OHLC candles
│   ├── search/route.ts         # GET: Search
│   ├── compare/route.ts        # GET: Compare coins
│   ├── categories/             # Category endpoints
│   ├── exchanges/              # Exchange endpoints
│   ├── tickers/[coinId]/       # Trading pairs
│   ├── social/[coinId]/        # Social metrics
│   ├── derivatives/route.ts    # Derivatives
│   └── defi/route.ts           # Global DeFi
│
├── defi/route.ts               # DeFi protocols
├── trending/route.ts           # Trending coins
├── sentiment/route.ts          # Fear & Greed
├── charts/route.ts             # Chart data
├── news/route.ts               # News feed
└── portfolio/                  # Portfolio CRUD
    ├── route.ts
    └── holding/route.ts
```

### Request Flow

```mermaid
flowchart LR
    subgraph Request
        R[HTTP Request]
        P[Parse Params]
        V[Validate]
    end

    subgraph Process
        C[Check Cache]
        F[Fetch Data]
        T[Transform]
    end

    subgraph Response
        H[Add Headers]
        J[JSON Response]
    end

    R --> P --> V
    V --> C
    C -->|Hit| H
    C -->|Miss| F --> T --> H
    H --> J
```

---

## State Management

### Client State

| State Type  | Storage                | Scope     | Persistence      |
| ----------- | ---------------------- | --------- | ---------------- |
| Server Data | SWR                    | Global    | Memory (session) |
| Theme       | Context + localStorage | Global    | Persistent       |
| Alerts      | Context + localStorage | Global    | Persistent       |
| Watchlist   | localStorage           | Global    | Persistent       |
| Portfolio   | API + localStorage     | User      | Persistent       |
| UI State    | useState/useReducer    | Component | None             |

### Provider Hierarchy

```tsx
<ThemeProvider>
  {' '}
  {/* Theme context */}
  <AlertsProvider>
    {' '}
    {/* Price alerts */}
    <BookmarksProvider>
      {' '}
      {/* Watchlist */}
      <SWRConfig>
        {' '}
        {/* Data fetching */}
        {children}
      </SWRConfig>
    </BookmarksProvider>
  </AlertsProvider>
</ThemeProvider>
```

---

## File Structure

```
crypto-data-aggregator/
│
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes (Edge Runtime)
│   │   ├── coin/[coinId]/      # Dynamic coin pages
│   │   ├── markets/            # Market sub-pages
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Home page
│   │
│   ├── components/             # React components
│   │   ├── alerts/             # Alert system
│   │   ├── cards/              # Card components
│   │   ├── charts/             # Chart components
│   │   ├── portfolio/          # Portfolio UI
│   │   ├── sidebar/            # Sidebar widgets
│   │   ├── watchlist/          # Watchlist UI
│   │   ├── Header.tsx          # Navigation
│   │   ├── Footer.tsx          # Footer
│   │   └── ThemeProvider.tsx   # Theme context
│   │
│   └── lib/                    # Core utilities
│       ├── market-data.ts      # CoinGecko/DeFiLlama client
│       ├── cache.ts            # Memory cache
│       ├── api-utils.ts        # Response helpers
│       ├── alerts.ts           # Alert system
│       ├── portfolio.ts        # Portfolio logic
│       └── watchlist.ts        # Watchlist logic
│
├── public/                     # Static assets
│   ├── icons/                  # App icons
│   └── manifest.json           # PWA manifest
│
├── docs/                       # Documentation
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   └── DEVELOPMENT.md
│
└── package.json
```

---

## External Dependencies

### Data Sources

```mermaid
flowchart LR
    subgraph App["Crypto Data Aggregator"]
        MD[market-data.ts]
    end

    subgraph APIs["Free APIs (No Key Required)"]
        CG[CoinGecko<br/>10-30 req/min]
        DL[DeFiLlama<br/>Unlimited]
        AM[Alternative.me<br/>Unlimited]
    end

    MD --> CG
    MD --> DL
    MD --> AM

    CG --> |Prices, Coins, Exchanges| MD
    DL --> |TVL, Protocols, Chains| MD
    AM --> |Fear & Greed| MD
```

### Rate Limit Handling

```mermaid
stateDiagram-v2
    [*] --> Ready
    Ready --> Requesting: canMakeRequest()
    Requesting --> Ready: Success
    Requesting --> Backoff: 429 Error
    Backoff --> Ready: Wait period

    note right of Backoff
        Exponential backoff
        Max 2 minutes
    end note
```

---

## Performance Optimizations

### Bundle Optimization

- **Code Splitting**: Automatic with Next.js App Router
- **Dynamic Imports**: Charts loaded on demand
- **Tree Shaking**: Unused code eliminated
- **Image Optimization**: Next.js Image component

### Runtime Optimization

- **Edge Runtime**: Low latency API responses
- **Streaming**: React Suspense for progressive loading
- **Prefetching**: Link prefetch for navigation
- **Caching**: Multi-layer cache strategy

### Metrics Targets

| Metric | Target  | Current       |
| ------ | ------- | ------------- |
| LCP    | < 2.5s  | ~1.8s         |
| FID    | < 100ms | ~50ms         |
| CLS    | < 0.1   | ~0.05         |
| TTFB   | < 200ms | ~100ms (Edge) |
