/**
 * Markets Page
 * Comprehensive markets dashboard for browsing, filtering, and discovering cryptocurrencies
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

export const metadata: Metadata = {
  title: 'Crypto Data Aggregator - Live Market Data & Analytics',
  description:
    'Real-time cryptocurrency prices, market data, DeFi analytics, portfolio tracking, and more. Your complete crypto data dashboard.',
  openGraph: {
    title: 'Crypto Data Aggregator - Live Market Data & Analytics',
    description:
      'Real-time cryptocurrency prices, market data, DeFi analytics, and portfolio tracking.',
    images: [{
      url: '/api/og?type=market&title=Crypto%20Data%20Aggregator&subtitle=Live%20Market%20Data%20%26%20Analytics',
      width: 1200,
      height: 630,
      alt: 'Crypto Data Aggregator - Live Market Dashboard',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Crypto Data Aggregator - Live Market Data & Analytics',
    description: 'Real-time cryptocurrency prices, market data, DeFi analytics, and portfolio tracking.',
    images: ['/api/og?type=market&title=Crypto%20Data%20Aggregator&subtitle=Live%20Market%20Data%20%26%20Analytics'],
  },
};

export const revalidate = 60; // Revalidate every minute

// Define valid sort fields
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

// Filter coins based on URL params
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

  // Search filter
  if (params.search) {
    const query = params.search.toLowerCase();
    filtered = filtered.filter(
      (coin) => coin.name.toLowerCase().includes(query) || coin.symbol.toLowerCase().includes(query)
    );
  }

  // Price range filter
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

  // Market cap filter
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

  // 24h change filter
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

// Sort coins based on URL params
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

export default async function MarketsPage({ searchParams }: MarketsPageProps) {
  const params = await searchParams;

  // Parse URL params
  const currentPage = Math.max(1, parseInt(params.page || '1', 10));
  const sortField = (
    VALID_SORT_FIELDS.includes(params.sort as SortField) ? params.sort : 'market_cap_rank'
  ) as SortField;
  const sortOrder = (params.order === 'asc' ? 'asc' : 'desc') as SortOrder;
  const perPage = [20, 50, 100].includes(parseInt(params.perPage || '50', 10))
    ? parseInt(params.perPage || '50', 10)
    : 50;
  const category = params.category || 'all';

  // Fetch data in parallel
  const [allCoins, trending, global, fearGreed] = await Promise.all([
    getTopCoins(250), // Get more coins for filtering
    getTrending(),
    getGlobalMarketData(),
    getFearGreedIndex(),
  ]);

  // Apply filters
  let filteredCoins = filterCoins(allCoins, {
    search: params.search,
    price: params.price,
    marketCap: params.marketCap,
    change: params.change,
  });

  // Apply sorting
  filteredCoins = sortCoins(filteredCoins, sortField, sortOrder);

  // Pagination
  const totalCount = filteredCoins.length;
  const startIndex = (currentPage - 1) * perPage;
  const paginatedCoins = filteredCoins.slice(startIndex, startIndex + perPage);

  return (
    <div className="min-h-screen bg-background">
      {/* Breaking News Ticker */}
      <BreakingNewsTicker />
      
      <div className="max-w-7xl mx-auto">
        <Header />

        {/* Global Stats Bar */}
        <GlobalStatsBar global={global} fearGreed={fearGreed} />

        <main className="px-4 py-6">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-primary" />
              Cryptocurrency Markets
            </h1>
            <p className="text-text-secondary">
              Live prices, charts, and market data for {totalCount.toLocaleString()}{' '}
              cryptocurrencies
            </p>
          </div>

          {/* Trending Section with Market Mood */}
          <div className="grid lg:grid-cols-4 gap-4 mb-6">
            <div className="lg:col-span-3">
              <Suspense fallback={<TrendingSectionSkeleton />}>
                <TrendingSection trending={trending} coins={allCoins} />
              </Suspense>
            </div>
            <div className="lg:col-span-1">
              <MarketMoodWidget variant="compact" showHistory />
            </div>
          </div>

          {/* Category Tabs */}
          <Suspense fallback={<CategoryTabsSkeleton />}>
            <CategoryTabs activeCategory={category} />
          </Suspense>

          {/* Search and Filters */}
          <Suspense fallback={<SearchFiltersSkeleton />}>
            <SearchAndFilters coins={allCoins} />
          </Suspense>

          {/* Coins Table with Sidebar */}
          <div className="grid lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
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
            <div className="lg:col-span-1 space-y-4">
              <SocialBuzzWidget />
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}

// Skeleton Components for Suspense
function TrendingSectionSkeleton() {
  return (
    <div className="grid md:grid-cols-2 gap-4 mb-6">
      {/* Hot Coins */}
      <div className="bg-surface rounded-xl border border-surface-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="skeleton-enhanced w-5 h-5 rounded" />
          <div className="skeleton-enhanced h-5 w-24 rounded" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="skeleton-enhanced h-10 w-24 rounded-lg flex-shrink-0"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      </div>
      {/* Top Gainers */}
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
      {/* Header */}
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
      {/* Rows with staggered animation */}
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
      {/* Pagination skeleton */}
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
