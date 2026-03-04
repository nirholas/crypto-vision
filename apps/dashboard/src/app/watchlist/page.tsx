'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Star,
  Trash2,
  Download,
  Upload,
  GripVertical,
  TrendingUp,
  TrendingDown,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  Bell,
  ExternalLink,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useWatchlist } from '@/components/watchlist/WatchlistProvider';
import { WatchlistExport } from '@/components/watchlist/WatchlistExport';
import { useToast } from '@/components/Toast';
import { TokenPrice, getTopCoins } from '@/lib/market-data';
import PageLayout from '@/components/PageLayout';

type SortField = 'name' | 'price' | 'change24h' | 'change7d' | 'marketCap' | 'addedAt';
type SortDirection = 'asc' | 'desc';

interface WatchlistTableItem extends TokenPrice {
  addedAt?: string;
}

export default function WatchlistPage() {
  const { watchlist, removeFromWatchlist, reorderWatchlist, clearWatchlist, isLoaded } =
    useWatchlist();
  const { addToast } = useToast();

  const [coins, setCoins] = useState<WatchlistTableItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCoins, setSelectedCoins] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('addedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  // Fetch coin data
  const fetchCoinData = useCallback(async () => {
    if (watchlist.length === 0) {
      setCoins([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      // Use getTopCoins and filter by watchlist
      const allCoins = await getTopCoins(250);
      const watchlistCoins = allCoins.filter((coin) => watchlist.includes(coin.id));
      setCoins(watchlistCoins);
    } catch (err) {
      console.error('Failed to fetch coin data:', err);
      setError('Failed to load coin data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [watchlist]);

  useEffect(() => {
    if (isLoaded) {
      fetchCoinData();
    }
  }, [isLoaded, fetchCoinData]);

  // Refresh data periodically
  useEffect(() => {
    if (!isLoaded) return;

    const interval = setInterval(fetchCoinData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [isLoaded, fetchCoinData]);

  // Filter and sort coins
  const filteredCoins = coins
    .filter((coin) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return coin.name.toLowerCase().includes(query) || coin.symbol.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'price':
          comparison = a.current_price - b.current_price;
          break;
        case 'change24h':
          comparison = (a.price_change_percentage_24h || 0) - (b.price_change_percentage_24h || 0);
          break;
        case 'change7d':
          comparison =
            (a.price_change_percentage_7d_in_currency || 0) -
            (b.price_change_percentage_7d_in_currency || 0);
          break;
        case 'marketCap':
          comparison = a.market_cap - b.market_cap;
          break;
        case 'addedAt':
          // Sort by watchlist order (which is addedAt desc)
          comparison = watchlist.indexOf(a.id) - watchlist.indexOf(b.id);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleSelectAll = () => {
    if (selectedCoins.size === filteredCoins.length) {
      setSelectedCoins(new Set());
    } else {
      setSelectedCoins(new Set(filteredCoins.map((c) => c.id)));
    }
  };

  const handleSelectCoin = (coinId: string) => {
    const newSelected = new Set(selectedCoins);
    if (newSelected.has(coinId)) {
      newSelected.delete(coinId);
    } else {
      newSelected.add(coinId);
    }
    setSelectedCoins(newSelected);
  };

  const handleBulkRemove = () => {
    selectedCoins.forEach((coinId) => {
      removeFromWatchlist(coinId);
    });
    addToast({
      type: 'success',
      title: 'Removed from watchlist',
      message: `${selectedCoins.size} coin${selectedCoins.size !== 1 ? 's' : ''} removed`,
    });
    setSelectedCoins(new Set());
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear your entire watchlist?')) {
      clearWatchlist();
      addToast({
        type: 'success',
        title: 'Watchlist cleared',
      });
    }
  };

  // Drag and drop handlers
  const handleDragStart = (coinId: string) => {
    setDraggedItem(coinId);
  };

  const handleDragOver = (e: React.DragEvent, coinId: string) => {
    e.preventDefault();
    if (draggedItem && draggedItem !== coinId) {
      const newOrder = [...watchlist];
      const draggedIndex = newOrder.indexOf(draggedItem);
      const targetIndex = newOrder.indexOf(coinId);

      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedItem);

      reorderWatchlist(newOrder);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  // Loading state
  if (!isLoaded || isLoading) {
    return (
      <PageLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-8">
            <Star className="w-8 h-8 text-yellow-500" />
            <h1 className="text-3xl font-bold">Watchlist</h1>
          </div>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-[var(--surface)] rounded-lg" />
            ))}
          </div>
        </div>
      </PageLayout>
    );
  }

  // Empty state
  if (watchlist.length === 0) {
    return (
      <PageLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-8">
            <Star className="w-8 h-8 text-yellow-500" />
            <h1 className="text-3xl font-bold">Watchlist</h1>
          </div>

          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--surface-border)] p-12 text-center">
            <Star className="w-16 h-16 text-[var(--text-muted)] mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Your watchlist is empty</h2>
            <p className="text-[var(--text-secondary)] mb-6 max-w-md mx-auto">
              Start building your watchlist by adding coins you want to track. Click the star icon
              on any coin to add it.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/markets"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl font-medium transition-colors"
              >
                Browse Markets
                <ExternalLink className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setShowExportModal(true)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--surface-hover)] hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)] rounded-xl font-medium transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import Watchlist
              </button>
            </div>

            {/* Suggested coins */}
            <div className="mt-10">
              <h3 className="text-sm font-medium text-[var(--text-muted)] mb-4">
                Popular coins to get started
              </h3>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { name: 'Bitcoin', id: 'bitcoin' },
                  { name: 'Ethereum', id: 'ethereum' },
                  { name: 'Solana', id: 'solana' },
                  { name: 'Cardano', id: 'cardano' },
                  { name: 'Polkadot', id: 'polkadot' },
                ].map((coin) => (
                  <Link
                    key={coin.id}
                    href={`/coin/${coin.id}`}
                    className="px-4 py-2 bg-[var(--surface-hover)] hover:bg-[var(--primary)]/20 rounded-full text-sm font-medium text-[var(--text-secondary)] transition-colors"
                  >
                    {coin.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Export/Import Modal */}
        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <WatchlistExport onClose={() => setShowExportModal(false)} />
            </div>
          </div>
        )}
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Star className="w-8 h-8 text-yellow-500 fill-yellow-500" />
            <div>
              <h1 className="text-3xl font-bold">Watchlist</h1>
              <p className="text-[var(--text-secondary)]">
                Tracking {watchlist.length} coin{watchlist.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchCoinData()}
              className="p-2 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-lg text-[var(--text-secondary)] font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-[var(--loss-bg)] border border-[var(--loss)] rounded-xl flex items-center gap-3 text-[var(--loss)]">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
            <button
              onClick={() => fetchCoinData()}
              className="ml-auto text-sm font-medium underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Search and Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search watchlist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent text-white placeholder-[var(--text-muted)]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-muted hover:text-text-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {selectedCoins.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-muted">
                {selectedCoins.size} selected
              </span>
              <button
                onClick={handleBulkRemove}
                className="flex items-center gap-2 px-4 py-2 bg-loss/20 hover:bg-loss/30 text-loss rounded-lg font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="px-4 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={
                        selectedCoins.size === filteredCoins.length && filteredCoins.length > 0
                      }
                      onChange={handleSelectAll}
                      className="rounded border-surface-border text-primary focus:ring-primary"
                    />
                  </th>
                  <th className="px-2 py-4 text-left w-8"></th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-text-muted">
                    #
                  </th>
                  <th className="px-4 py-4 text-left">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 text-sm font-semibold text-text-muted hover:text-text-primary"
                    >
                      Name <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="px-4 py-4 text-right">
                    <button
                      onClick={() => handleSort('price')}
                      className="flex items-center gap-1 text-sm font-semibold text-text-muted hover:text-text-primary ml-auto"
                    >
                      Price <SortIcon field="price" />
                    </button>
                  </th>
                  <th className="px-4 py-4 text-right">
                    <button
                      onClick={() => handleSort('change24h')}
                      className="flex items-center gap-1 text-sm font-semibold text-text-muted hover:text-text-primary ml-auto"
                    >
                      24h <SortIcon field="change24h" />
                    </button>
                  </th>
                  <th className="px-4 py-4 text-right hidden md:table-cell">
                    <button
                      onClick={() => handleSort('change7d')}
                      className="flex items-center gap-1 text-sm font-semibold text-text-muted hover:text-text-primary ml-auto"
                    >
                      7d <SortIcon field="change7d" />
                    </button>
                  </th>
                  <th className="px-4 py-4 text-right hidden lg:table-cell">
                    <button
                      onClick={() => handleSort('marketCap')}
                      className="flex items-center gap-1 text-sm font-semibold text-text-muted hover:text-text-primary ml-auto"
                    >
                      Market Cap <SortIcon field="marketCap" />
                    </button>
                  </th>
                  <th className="px-4 py-4 text-right text-sm font-semibold text-text-muted">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCoins.map((coin, index) => (
                  <tr
                    key={coin.id}
                    className={`border-b border-surface-border hover:bg-surface-hover transition-colors ${
                      draggedItem === coin.id ? 'opacity-50' : ''
                    }`}
                    draggable
                    onDragStart={() => handleDragStart(coin.id)}
                    onDragOver={(e) => handleDragOver(e, coin.id)}
                    onDragEnd={handleDragEnd}
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedCoins.has(coin.id)}
                        onChange={() => handleSelectCoin(coin.id)}
                        className="rounded border-surface-border text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="px-2 py-4">
                      <GripVertical className="w-4 h-4 text-text-muted cursor-grab active:cursor-grabbing" />
                    </td>
                    <td className="px-4 py-4 text-sm text-text-muted">
                      {coin.market_cap_rank || '-'}
                    </td>
                    <td className="px-4 py-4">
                      <Link href={`/coin/${coin.id}`} className="flex items-center gap-3 group">
                        {coin.image ? (
                          <img src={coin.image} alt={coin.name} className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-surface-alt" />
                        )}
                        <div>
                          <p className="font-semibold text-text-primary group-hover:text-primary transition-colors">
                            {coin.name}
                          </p>
                          <p className="text-sm text-text-muted">
                            {coin.symbol.toUpperCase()}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-text-primary">
                      $
                      {coin.current_price.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: coin.current_price < 1 ? 6 : 2,
                      })}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          (coin.price_change_percentage_24h || 0) >= 0
                            ? 'text-gain'
                            : 'text-loss'
                        }`}
                      >
                        {(coin.price_change_percentage_24h || 0) >= 0 ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        {Math.abs(coin.price_change_percentage_24h || 0).toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right hidden md:table-cell">
                      <span
                        className={`font-medium ${
                          (coin.price_change_percentage_7d_in_currency || 0) >= 0
                            ? 'text-gain'
                            : 'text-loss'
                        }`}
                      >
                        {(coin.price_change_percentage_7d_in_currency || 0) >= 0 ? '+' : ''}
                        {(coin.price_change_percentage_7d_in_currency || 0).toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right hidden lg:table-cell text-text-secondary">
                      ${(coin.market_cap / 1e9).toFixed(2)}B
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/coin/${coin.id}#alerts`}
                          className="p-2 rounded-lg hover:bg-surface-hover text-text-muted hover:text-primary transition-colors"
                          title="Set alert"
                        >
                          <Bell className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => {
                            removeFromWatchlist(coin.id);
                            addToast({
                              type: 'info',
                              title: 'Removed from watchlist',
                              message: coin.name,
                              duration: 3000,
                            });
                          }}
                          className="p-2 rounded-lg hover:bg-loss/20 text-text-muted hover:text-loss transition-colors"
                          title="Remove from watchlist"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* No results */}
          {filteredCoins.length === 0 && searchQuery && (
            <div className="p-12 text-center">
              <Search className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <p className="text-text-muted">
                No coins found matching &quot;{searchQuery}&quot;
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-[var(--text-secondary)]">
            Drag rows to reorder • Data refreshes every minute
          </p>
          <button onClick={handleClearAll} className="text-sm text-[var(--loss)] hover:underline">
            Clear all
          </button>
        </div>

        {/* Export/Import Modal */}
        {showExportModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowExportModal(false)}
          >
            <div className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <WatchlistExport onClose={() => setShowExportModal(false)} />
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
