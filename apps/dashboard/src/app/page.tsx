/**
 * Home Page — Trading Dashboard Overview
 *
 * Three-column grid layout with global stats strip, price ticker table,
 * trending/gainers/losers sidebar, and market mood widgets.
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Suspense } from 'react';
import {
  getTopCoins,
  getTrending,
  getGlobalMarketData,
  getFearGreedIndex,
  type TokenPrice,
} from '@/lib/market-data';
import type { Metadata } from 'next';
import { BarChart3 } from 'lucide-react';

// Components
import GlobalStatsBar from './markets/components/GlobalStatsBar';
import TrendingSection from './markets/components/TrendingSection';
import CategoryTabs from './markets/components/CategoryTabs';
import SearchAndFilters from './markets/components/SearchAndFilters';
import CoinsTable from './markets/components/CoinsTable';
import MarketMoodWidget from '@/components/MarketMoodWidget';
import { BreakingNewsTicker } from '@/components/BreakingNewsTicker';
import { SocialBuzzWidget } from '@/components/SocialBuzz';
import type { SortField, SortOrder } from './markets/components/SortableHeader';
import { HomePageClient } from './HomePageClient';

export const metadata: Metadata = {
  title: 'Crypto Vision — Trading Dashboard',
  description:
    'Real-time cryptocurrency trading dashboard with live prices, market data, Fear & Greed Index, trending coins, and analytics.',
  openGraph: {
    title: 'Crypto Vision — Trading Dashboard',
    description:
      'Real-time cryptocurrency prices, market data, DeFi analytics, and portfolio tracking.',
    images: [{
      url: '/api/og?type=market&title=Crypto%20Vision&subtitle=Trading%20Dashboard',
      width: 1200,
      height: 630,
      alt: 'Crypto Vision — Trading Dashboard',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Crypto Vision — Trading Dashboard',
    description: 'Real-time cryptocurrency prices, market data, DeFi analytics, and portfolio tracking.',
    images: ['/api/og?type=market&title=Crypto%20Vision&subtitle=Trading%20Dashboard'],
  },
};

export const revalidate = 60;

const VALID_SORT_FIELDS: SortField[] = [
  'market_cap_rank',
  'current_price',
  'price_change_percentage_1h_in_currency',
  'price_change_percentage_24h',
  'price_change_percentage_7d_in_currency',
  'market_cap',
  'total_volume',
  'circulating_supply',
];

interface MarketsPageProps {
  searchParams: Promise<{
    page?: string;
    sort?: string;
    order?: string;
    category?: string;
    search?: string;
    price?: string;
    marketCap?: string;
    change?: string;
    perPage?: string;
  }>;
}

function filterCoins(
  coins: TokenPrice[],
  params: {
    search?: string;
    price?: string;
    marketCap?: string;
    change?: string;
  }
): TokenPrice[] {
  let filtered = [...coins];

  if (params.search) {
    const query = params.search.toLowerCase();
    filtered = filtered.filter(
      (coin) => coin.name.toLowerCase().includes(query) || coin.symbol.toLowerCase().includes(query)
    );
  }

  if (params.price && params.price !== 'all') {
    filtered = filtered.filter((coin) => {
      const price = coin.current_price;
      switch (params.price) {
        case '0-1':
          return price >= 0 && price < 1;
        case '1-10':
          return price >= 1 && price < 10;
        case '10-100':
          return price >= 10 && price < 100;
        case '100+':
          return price >= 100;
        default:
          return true;
      }
    });
  }

  if (params.marketCap && params.marketCap !== 'all') {
    filtered = filtered.filter((coin) => {
      const cap = coin.market_cap;
      switch (params.marketCap) {
        case '1b+':
          return cap >= 1_000_000_000;
        case '100m+':
          return cap >= 100_000_000;
        case '10m+':
          return cap >= 10_000_000;
        case '<10m':
          return cap < 10_000_000;
        default:
          return true;
      }
    });
  }

  if (params.change && params.change !== 'all') {
    filtered = filtered.filter((coin) => {
      const change = coin.price_change_percentage_24h || 0;
      switch (params.change) {
        case 'gainers':
          return change > 0;
        case 'losers':
          return change < 0;
        default:
          return true;
      }
    });
  }

  return filtered;
}

function sortCoins(coins: TokenPrice[], sortField: SortField, order: SortOrder): TokenPrice[] {
  const sorted = [...coins];

  sorted.sort((a, b) => {
    let aValue: number;
    let bValue: number;

    switch (sortField) {
      case 'market_cap_rank':
        aValue = a.market_cap_rank || 9999;
        bValue = b.market_cap_rank || 9999;
        break;
      case 'current_price':
        aValue = a.current_price || 0;
        bValue = b.current_price || 0;
        break;
      case 'price_change_percentage_24h':
        aValue = a.price_change_percentage_24h || 0;
        bValue = b.price_change_percentage_24h || 0;
        break;
      case 'price_change_percentage_7d_in_currency':
        aValue = a.price_change_percentage_7d_in_currency || 0;
        bValue = b.price_change_percentage_7d_in_currency || 0;
        break;
      case 'market_cap':
        aValue = a.market_cap || 0;
        bValue = b.market_cap || 0;
        break;
      case 'total_volume':
        aValue = a.total_volume || 0;
        bValue = b.total_volume || 0;
        break;
      case 'circulating_supply':
        aValue = a.circulating_supply || 0;
        bValue = b.circulating_supply || 0;
        break;
      default:
        aValue = a.market_cap_rank || 9999;
        bValue = b.market_cap_rank || 9999;
    }

    if (order === 'asc') {
      return aValue - bValue;
    }
    return bValue - aValue;
  });

  return sorted;
}

export default async function HomePage({ searchParams }: MarketsPageProps) {
  const params = await searchParams;

  const currentPage = Math.max(1, parseInt(params.page || '1', 10));
  const sortField = (
    VALID_SORT_FIELDS.includes(params.sort as SortField) ? params.sort : 'market_cap_rank'
  ) as SortField;
  const sortOrder = (params.order === 'asc' ? 'asc' : 'desc') as SortOrder;
  const perPage = [20, 50, 100].includes(parseInt(params.perPage || '50', 10))
    ? parseInt(params.perPage || '50', 10)
    : 50;
  const category = params.category || 'all';

  // Fetch all data in parallel
  const [allCoins, trending, global, fearGreed] = await Promise.all([
    getTopCoins(250),
    getTrending(),
    getGlobalMarketData(),
    getFearGreedIndex(),
  ]);

  // Apply filters and sorting
  let filteredCoins = filterCoins(allCoins, {
    search: params.search,
    price: params.price,
    marketCap: params.marketCap,
    change: params.change,
  });
  filteredCoins = sortCoins(filteredCoins, sortField, sortOrder);

  const totalCount = filteredCoins.length;
  const startIndex = (currentPage - 1) * perPage;
  const paginatedCoins = filteredCoins.slice(startIndex, startIndex + perPage);

  // Derive gainers/losers from allCoins
  const sortedByChange = [...allCoins].sort(
    (a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)
  );
  const topGainers = sortedByChange.filter(c => (c.price_change_percentage_24h || 0) > 0).slice(0, 5);
  const topLosers = sortedByChange.filter(c => (c.price_change_percentage_24h || 0) < 0).slice(-5).reverse();

  return (
    <div className="min-h-screen bg-background">
      {/* Breaking News Ticker */}
      <BreakingNewsTicker />

      <div className="max-w-[1600px] mx-auto">
        <Header />

        {/* Global Stats Strip */}
        <GlobalStatsBar global={global} fearGreed={fearGreed} />

        <main className="px-4 py-6">
          {/* 3-Column Trading Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Column 1 (Wide) — Price Ticker Table */}
            <div className="lg:col-span-8 xl:col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Market Overview
                </h2>
                <span className="text-xs text-text-muted">
                  {totalCount.toLocaleString()} coins
                </span>
              </div>

              <Suspense fallback={<CategoryTabsSkeleton />}>
                <CategoryTabs activeCategory={category} />
              </Suspense>

              <Suspense fallback={<SearchFiltersSkeleton />}>
                <SearchAndFilters coins={allCoins} />
              </Suspense>

              <Suspense fallback={<TableSkeleton />}>
                <CoinsTable
                  coins={paginatedCoins}
                  totalCount={totalCount}
                  currentPage={currentPage}
                  itemsPerPage={perPage}
                  currentSort={sortField}
                  currentOrder={sortOrder}
                  showWatchlist={true}
                />
              </Suspense>
            </div>

            {/* Column 2+3 (Sidebar) — Trending, Gainers, Mood, Stats */}
            <div className="lg:col-span-4 xl:col-span-4 space-y-4">
              <Suspense fallback={<TrendingSectionSidebarSkeleton />}>
                <TrendingSection trending={trending} coins={allCoins} />
              </Suspense>

              <MarketMoodWidget variant="compact" showHistory />

              <HomePageClient
                global={global}
                fearGreed={fearGreed}
                topGainers={topGainers}
                topLosers={topLosers}
              />

              <SocialBuzzWidget />
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}

// ─── Skeleton Components ───────────────────────────────────────────────────────

function CategoryTabsSkeleton() {
  return (
    <div className="flex gap-2 mb-4 overflow-hidden">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div
          key={i}
          className="skeleton-enhanced h-10 w-24 rounded-full flex-shrink-0"
          style={{ animationDelay: `${i * 40}ms` }}
        />
      ))}
    </div>
  );
}

function SearchFiltersSkeleton() {
  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <div className="skeleton-enhanced h-10 w-64 rounded-xl" />
      <div className="skeleton-enhanced h-10 w-32 rounded-lg" style={{ animationDelay: '50ms' }} />
      <div className="skeleton-enhanced h-10 w-32 rounded-lg" style={{ animationDelay: '100ms' }} />
      <div className="skeleton-enhanced h-10 w-32 rounded-lg" style={{ animationDelay: '150ms' }} />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-surface rounded-xl border border-surface-border overflow-hidden">
      <div className="p-4 border-b border-surface-border bg-surface-alt">
        <div className="flex items-center gap-4">
          <div className="skeleton-enhanced h-4 w-8 rounded" />
          <div className="skeleton-enhanced h-4 w-16 rounded" />
          <div className="skeleton-enhanced h-4 w-16 rounded ml-auto" />
          <div className="skeleton-enhanced h-4 w-14 rounded hidden sm:block" />
          <div className="skeleton-enhanced h-4 w-14 rounded hidden md:block" />
          <div className="skeleton-enhanced h-4 w-20 rounded hidden lg:block" />
        </div>
      </div>
      <div className="divide-y divide-surface-border">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 coin-row-skeleton"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="skeleton-enhanced h-4 w-8 rounded" />
            <div className="skeleton-enhanced h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <div className="skeleton-enhanced h-4 w-24 rounded" />
              <div className="skeleton-enhanced h-3 w-12 rounded" />
            </div>
            <div className="skeleton-enhanced h-4 w-20 rounded ml-auto" />
            <div className="skeleton-enhanced h-4 w-14 rounded hidden sm:block" />
            <div className="skeleton-enhanced h-4 w-14 rounded hidden md:block" />
            <div className="skeleton-enhanced h-4 w-24 rounded hidden lg:block" />
            <div className="skeleton-enhanced h-10 w-20 rounded-lg hidden lg:block" />
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-surface-border flex items-center justify-between">
        <div className="skeleton-enhanced h-4 w-32 rounded" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="skeleton-enhanced h-8 w-8 rounded-lg"
              style={{ animationDelay: `${550 + i * 30}ms` }}
            />
          ))}
        </div>
        <div className="skeleton-enhanced h-4 w-24 rounded" />
      </div>
    </div>
  );
}

function TrendingSectionSidebarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-xl border border-surface-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="skeleton-enhanced w-5 h-5 rounded" />
          <div className="skeleton-enhanced h-5 w-24 rounded" />
        </div>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="skeleton-enhanced h-10 w-24 rounded-lg flex-shrink-0"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      </div>
      <div className="bg-surface rounded-xl border border-surface-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="skeleton-enhanced w-5 h-5 rounded" />
          <div className="skeleton-enhanced h-5 w-28 rounded" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center gap-2"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="skeleton-enhanced w-6 h-6 rounded-full" />
              <div className="skeleton-enhanced h-4 flex-1 rounded" />
              <div className="skeleton-enhanced h-4 w-16 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
