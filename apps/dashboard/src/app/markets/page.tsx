/**
 * Markets Page — Full Cryptocurrency Market Browser
 *
 * Category-filtered, searchable, sortable, paginated (100/page) coin table.
 * Trading-terminal aesthetic with dark theme.
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
import GlobalStatsBar from './components/GlobalStatsBar';
import TrendingSection from './components/TrendingSection';
import CategoryTabs from './components/CategoryTabs';
import SearchAndFilters from './components/SearchAndFilters';
import CoinsTable from './components/CoinsTable';
import type { SortField, SortOrder } from './components/SortableHeader';

export const metadata: Metadata = {
  title: 'Crypto Markets — All Coins | Crypto Vision',
  description:
    'Browse all cryptocurrencies with live prices, market data, charts, and analytics. Filter by category, sort by any metric.',
  openGraph: {
    title: 'Crypto Markets — All Coins',
    description: 'Live cryptocurrency prices, market data, charts, and analytics.',
    images: [{
      url: '/api/og?type=market&title=Crypto%20Markets&subtitle=All%20Coins',
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Crypto Markets — All Coins',
    description: 'Live cryptocurrency prices, market data, charts, and analytics.',
    images: ['/api/og?type=market&title=Crypto%20Markets&subtitle=All%20Coins'],
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
        case '0-1': return price >= 0 && price < 1;
        case '1-10': return price >= 1 && price < 10;
        case '10-100': return price >= 10 && price < 100;
        case '100+': return price >= 100;
        default: return true;
      }
    });
  }

  if (params.marketCap && params.marketCap !== 'all') {
    filtered = filtered.filter((coin) => {
      const cap = coin.market_cap;
      switch (params.marketCap) {
        case '1b+': return cap >= 1_000_000_000;
        case '100m+': return cap >= 100_000_000;
        case '10m+': return cap >= 10_000_000;
        case '<10m': return cap < 10_000_000;
        default: return true;
      }
    });
  }

  if (params.change && params.change !== 'all') {
    filtered = filtered.filter((coin) => {
      const change = coin.price_change_percentage_24h || 0;
      switch (params.change) {
        case 'gainers': return change > 0;
        case 'losers': return change < 0;
        default: return true;
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
      case 'market_cap_rank': aValue = a.market_cap_rank || 9999; bValue = b.market_cap_rank || 9999; break;
      case 'current_price': aValue = a.current_price || 0; bValue = b.current_price || 0; break;
      case 'price_change_percentage_24h': aValue = a.price_change_percentage_24h || 0; bValue = b.price_change_percentage_24h || 0; break;
      case 'price_change_percentage_7d_in_currency': aValue = a.price_change_percentage_7d_in_currency || 0; bValue = b.price_change_percentage_7d_in_currency || 0; break;
      case 'market_cap': aValue = a.market_cap || 0; bValue = b.market_cap || 0; break;
      case 'total_volume': aValue = a.total_volume || 0; bValue = b.total_volume || 0; break;
      case 'circulating_supply': aValue = a.circulating_supply || 0; bValue = b.circulating_supply || 0; break;
      default: aValue = a.market_cap_rank || 9999; bValue = b.market_cap_rank || 9999;
    }

    return order === 'asc' ? aValue - bValue : bValue - aValue;
  });

  return sorted;
}

export default async function MarketsPage({ searchParams }: MarketsPageProps) {
  const params = await searchParams;

  const currentPage = Math.max(1, parseInt(params.page || '1', 10));
  const sortField = (
    VALID_SORT_FIELDS.includes(params.sort as SortField) ? params.sort : 'market_cap_rank'
  ) as SortField;
  const sortOrder = (params.order === 'asc' ? 'asc' : 'desc') as SortOrder;
  const perPage = [20, 50, 100].includes(parseInt(params.perPage || '100', 10))
    ? parseInt(params.perPage || '100', 10)
    : 100;
  const category = params.category || 'all';

  const [allCoins, trending, global, fearGreed] = await Promise.all([
    getTopCoins(250),
    getTrending(),
    getGlobalMarketData(),
    getFearGreedIndex(),
  ]);

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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto">
        <Header />

        <GlobalStatsBar global={global} fearGreed={fearGreed} />

        <main className="px-4 py-6">
          {/* Page Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-7 h-7 text-primary" />
              <h1 className="text-3xl font-bold text-text-primary">Cryptocurrency Markets</h1>
            </div>
            <p className="text-text-secondary mt-2">
              Live prices, charts, and market data for {totalCount.toLocaleString()} cryptocurrencies
            </p>
          </div>

          {/* Trending Strip */}
          <Suspense fallback={<TrendingSkeleton />}>
            <TrendingSection trending={trending} coins={allCoins} />
          </Suspense>

          {/* Category Tabs */}
          <Suspense fallback={<TabsSkeleton />}>
            <CategoryTabs activeCategory={category} />
          </Suspense>

          {/* Filter Bar */}
          <Suspense fallback={<FiltersSkeleton />}>
            <SearchAndFilters coins={allCoins} />
          </Suspense>

          {/* Full Data Table — 100 coins per page */}
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

function TrendingSkeleton() {
  return (
    <div className="grid md:grid-cols-2 gap-4 mb-6">
      {[1, 2].map((i) => (
        <div key={i} className="bg-surface rounded-xl border border-surface-border p-4">
          <div className="skeleton-enhanced h-6 w-32 rounded mb-3" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((j) => (
              <div key={j} className="skeleton-enhanced h-8 rounded" style={{ animationDelay: `${j * 40}ms` }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TabsSkeleton() {
  return (
    <div className="flex gap-2 mb-4 overflow-hidden">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="skeleton-enhanced h-10 w-24 rounded-full flex-shrink-0" style={{ animationDelay: `${i * 40}ms` }} />
      ))}
    </div>
  );
}

function FiltersSkeleton() {
  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <div className="skeleton-enhanced h-10 w-64 rounded-xl" />
      <div className="skeleton-enhanced h-10 w-32 rounded-lg" />
      <div className="skeleton-enhanced h-10 w-32 rounded-lg" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-surface rounded-xl border border-surface-border overflow-hidden">
      <div className="p-4 border-b border-surface-border">
        <div className="skeleton-enhanced h-6 w-48 rounded" />
      </div>
      <div className="divide-y divide-surface-border">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="skeleton-enhanced h-4 w-8 rounded" />
            <div className="skeleton-enhanced h-8 w-8 rounded-full" />
            <div className="skeleton-enhanced h-4 w-32 rounded" />
            <div className="skeleton-enhanced h-4 w-20 rounded ml-auto" />
            <div className="skeleton-enhanced h-4 w-16 rounded hidden sm:block" />
            <div className="skeleton-enhanced h-4 w-24 rounded hidden lg:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
