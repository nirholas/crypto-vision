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

// Components
import GlobalStatsBar from './components/GlobalStatsBar';
import TrendingSection from './components/TrendingSection';
import CategoryTabs from './components/CategoryTabs';
import SearchAndFilters from './components/SearchAndFilters';
import CoinsTable from './components/CoinsTable';
import type { SortField, SortOrder } from './components/SortableHeader';

export const metadata: Metadata = {
  title: 'Crypto Markets - Crypto Data Aggregator',
  description:
    'Live cryptocurrency prices, market data, charts, and analytics. Browse and discover cryptocurrencies.',
  openGraph: {
    title: 'Crypto Markets 📈💰',
    description: 'Live cryptocurrency prices, market data, charts, and analytics.',
    images: [{
      url: '/api/og?type=market&title=Crypto%20Markets&subtitle=Live%20Prices%20%26%20Analytics',
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Crypto Markets 📈💰',
    description: 'Live cryptocurrency prices, market data, charts, and analytics.',
    images: ['/api/og?type=market&title=Crypto%20Markets&subtitle=Live%20Prices%20%26%20Analytics'],
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
    <div className="min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto">
        <Header />

        {/* Global Stats Bar */}
        <GlobalStatsBar global={global} fearGreed={fearGreed} />

        <main className="px-4 py-6">
          {/* Page Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <svg
                className="w-7 h-7 text-text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <h1 className="text-3xl font-bold text-text-primary">Cryptocurrency Markets</h1>
            </div>
            <p className="text-text-secondary mt-2">
              Live prices, charts, and market data for {totalCount.toLocaleString()}{' '}
              cryptocurrencies
            </p>
          </div>

          {/* Trending Section */}
          <Suspense fallback={<TrendingSectionSkeleton />}>
            <TrendingSection trending={trending} coins={allCoins} />
          </Suspense>

          {/* Category Tabs */}
          <Suspense fallback={<CategoryTabsSkeleton />}>
            <CategoryTabs activeCategory={category} />
          </Suspense>

          {/* Search and Filters */}
          <Suspense fallback={<SearchFiltersSkeleton />}>
            <SearchAndFilters coins={allCoins} />
          </Suspense>

          {/* Coins Table */}
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
      <div className="bg-surface rounded-xl border border-surface-border p-4">
        <div className="h-6 w-32 bg-surface-alt rounded mb-3 animate-pulse" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 w-24 bg-surface-alt rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
      <div className="bg-surface rounded-xl border border-surface-border p-4">
        <div className="h-6 w-32 bg-surface-alt rounded mb-3 animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 bg-surface-alt rounded animate-pulse" />
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
          className="h-10 w-24 bg-surface-alt rounded-full animate-pulse flex-shrink-0"
        />
      ))}
    </div>
  );
}

function SearchFiltersSkeleton() {
  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <div className="h-10 w-64 bg-surface-alt rounded-xl animate-pulse" />
      <div className="h-10 w-32 bg-surface-alt rounded-lg animate-pulse" />
      <div className="h-10 w-32 bg-surface-alt rounded-lg animate-pulse" />
      <div className="h-10 w-32 bg-surface-alt rounded-lg animate-pulse" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-surface rounded-xl border border-surface-border overflow-hidden">
      <div className="p-4 border-b border-surface-border">
        <div className="h-6 w-48 bg-surface-alt rounded animate-pulse" />
      </div>
      <div className="divide-y divide-surface-border">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="h-4 w-8 bg-surface-alt rounded animate-pulse" />
            <div className="h-8 w-8 bg-surface-alt rounded-full animate-pulse" />
            <div className="h-4 w-32 bg-surface-alt rounded animate-pulse" />
            <div className="h-4 w-20 bg-surface-alt rounded animate-pulse ml-auto" />
            <div className="h-4 w-16 bg-surface-alt rounded animate-pulse hidden sm:block" />
            <div className="h-4 w-16 bg-surface-alt rounded animate-pulse hidden md:block" />
            <div className="h-4 w-24 bg-surface-alt rounded animate-pulse hidden lg:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
