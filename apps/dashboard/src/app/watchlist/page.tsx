'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  LayoutGrid,
  LayoutList,
} from 'lucide-react';
import { useWatchlist } from '@/components/watchlist/WatchlistProvider';
import { WatchlistExport } from '@/components/watchlist/WatchlistExport';
import { useToast } from '@/components/Toast';
import { TokenPrice, getTopCoins } from '@/lib/market-data';
import Sparkline from '@/components/ui/Sparkline';
import PageLayout from '@/components/PageLayout';

type SortField = 'name' | 'price' | 'change24h' | 'change7d' | 'marketCap' | 'addedAt';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'table' | 'card';

export default function WatchlistPage() {
  const { watchlist, removeFromWatchlist, reorderWatchlist, clearWatchlist, isLoaded } =
    useWatchlist();
  const { addToast } = useToast();

  const [coins, setCoins] = useState<TokenPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCoins, setSelectedCoins] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('addedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // Fetch coin data
  const fetchCoinData = useCallback(async () => {
    if (watchlist.length === 0) {
      setCoins([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
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

  useEffect(() => {
    if (!isLoaded) return;
    const interval = setInterval(fetchCoinData, 60000);
    return () => clearInterval(interval);
  }, [isLoaded, fetchCoinData]);

  // Filter and sort coins
  const filteredCoins = useMemo(() => {
    let filtered = coins.filter((coin) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return coin.name.toLowerCase().includes(query) || coin.symbol.toLowerCase().includes(query);
    });

    return filtered.sort((a, b) => {
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
          comparison = watchlist.indexOf(a.id) - watchlist.indexOf(b.id);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [coins, searchQuery, sortField, sortDirection, watchlist]);

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
      addToast({ type: 'success', title: 'Watchlist cleared' });
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

  const SortHeader = ({ field, children, className: cn = '' }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] uppercase tracking-wider ${cn}`}
    >
      {children}
      {sortField === field && (
        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      )}
    </button>
  );

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
              <div key={i} className="h-16 bg-[var(--surface)] rounded-2xl border border-[var(--surface-border)]" />
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
            <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-[var(--surface-hover)] flex items-center justify-center">
              <Star className="w-10 h-10 text-[var(--text-muted)]" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Your watchlist is empty</h2>
            <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
              Start building your watchlist by adding coins you want to track. Click the star icon
              on any coin to add it.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/markets"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl font-semibold transition-colors"
              >
                Browse Markets
                <ExternalLink className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setShowExportModal(true)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--surface-hover)] hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)] rounded-xl font-semibold transition-colors border border-[var(--surface-border)]"
              >
                <Upload className="w-4 h-4" />
                Import Watchlist
              </button>
            </div>

            <div className="mt-10 pt-8 border-t border-[var(--surface-border)]">
              <p className="text-xs text-[var(--text-muted)] mb-3">Popular coins to get started</p>
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

        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowExportModal(false)}>
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
              <p className="text-[var(--text-secondary)] text-sm">
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

            {/* View toggle */}
            <div className="flex items-center gap-0.5 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                title="Table view"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('card')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'card' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                title="Card view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-lg text-[var(--text-secondary)] font-medium transition-colors border border-[var(--surface-border)]"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-[var(--loss)]/10 border border-[var(--loss)]/30 rounded-xl flex items-center gap-3 text-[var(--loss)]">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="flex-1">{error}</p>
            <button onClick={() => fetchCoinData()} className="text-sm font-medium underline">
              Retry
            </button>
          </div>
        )}

        {/* Search and Bulk Actions */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search watchlist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {selectedCoins.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--text-muted)]">
                {selectedCoins.size} selected
              </span>
              <button
                onClick={handleBulkRemove}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--loss)]/20 hover:bg-[var(--loss)]/30 text-[var(--loss)] rounded-lg font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Remove
              </button>
            </div>
          )}
        </div>

        {/* ─── Card View ──────────────────────────────────────────────────── */}
        {viewMode === 'card' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            {filteredCoins.map((coin) => {
              const change24h = coin.price_change_percentage_24h || 0;
              const change7d = coin.price_change_percentage_7d_in_currency || 0;
              const sparklineData = coin.sparkline_in_7d?.price;
              return (
                <div
                  key={coin.id}
                  className="bg-[var(--surface)] rounded-2xl border border-[var(--surface-border)] p-4 hover:bg-[var(--surface-hover)] transition-colors group"
                  draggable
                  onDragStart={() => handleDragStart(coin.id)}
                  onDragOver={(e) => handleDragOver(e, coin.id)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="flex items-start justify-between mb-3">
                    <Link href={`/coin/${coin.id}`} className="flex items-center gap-3">
                      {coin.image ? (
                        <img src={coin.image} alt={coin.name} className="w-10 h-10 rounded-full" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[var(--surface-hover)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)]">
                          {coin.symbol.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors text-sm">
                          {coin.name}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {coin.symbol.toUpperCase()} · #{coin.market_cap_rank || '?'}
                        </p>
                      </div>
                    </Link>
                    <button
                      onClick={() => {
                        removeFromWatchlist(coin.id);
                        addToast({ type: 'info', title: 'Removed', message: coin.name });
                      }}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--loss)]/20 hover:text-[var(--loss)] transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Sparkline */}
                  {sparklineData && sparklineData.length > 1 && (
                    <div className="mb-3">
                      <Sparkline data={sparklineData} width={248} height={48} isPositive={change7d >= 0} />
                    </div>
                  )}

                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-lg font-bold text-[var(--text-primary)] tabular-nums">
                        ${coin.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: coin.current_price < 1 ? 6 : 2 })}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        MCap ${(coin.market_cap / 1e9).toFixed(2)}B
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-medium ${change24h >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
                        {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
                      </span>
                      <p className={`text-xs ${change7d >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
                        7d: {change7d >= 0 ? '+' : ''}{change7d.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Table View ─────────────────────────────────────────────────── */}
        {viewMode === 'table' && (
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--surface-border)] overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--surface-border)]">
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedCoins.size === filteredCoins.length && filteredCoins.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-[var(--surface-border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                      />
                    </th>
                    <th className="px-2 py-3 text-left w-8" />
                    <th className="px-3 py-3 text-left">
                      <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">#</span>
                    </th>
                    <th className="px-3 py-3 text-left"><SortHeader field="name">Name</SortHeader></th>
                    <th className="px-3 py-3 text-right"><SortHeader field="price" className="ml-auto">Price</SortHeader></th>
                    <th className="px-3 py-3 text-right"><SortHeader field="change24h" className="ml-auto">24h</SortHeader></th>
                    <th className="px-3 py-3 text-right hidden md:table-cell"><SortHeader field="change7d" className="ml-auto">7d</SortHeader></th>
                    <th className="px-3 py-3 text-right hidden sm:table-cell">
                      <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">7d Chart</span>
                    </th>
                    <th className="px-3 py-3 text-right hidden lg:table-cell"><SortHeader field="marketCap" className="ml-auto">Market Cap</SortHeader></th>
                    <th className="px-3 py-3 text-right">
                      <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCoins.map((coin) => {
                    const change24h = coin.price_change_percentage_24h || 0;
                    const change7d = coin.price_change_percentage_7d_in_currency || 0;
                    const sparklineData = coin.sparkline_in_7d?.price;
                    return (
                      <tr
                        key={coin.id}
                        className={`border-b border-[var(--surface-border)]/50 hover:bg-[var(--surface-hover)] transition-colors ${
                          draggedItem === coin.id ? 'opacity-50' : ''
                        }`}
                        draggable
                        onDragStart={() => handleDragStart(coin.id)}
                        onDragOver={(e) => handleDragOver(e, coin.id)}
                        onDragEnd={handleDragEnd}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedCoins.has(coin.id)}
                            onChange={() => handleSelectCoin(coin.id)}
                            className="rounded border-[var(--surface-border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                          />
                        </td>
                        <td className="px-2 py-3">
                          <GripVertical className="w-4 h-4 text-[var(--text-muted)] cursor-grab active:cursor-grabbing" />
                        </td>
                        <td className="px-3 py-3 text-sm text-[var(--text-muted)]">
                          {coin.market_cap_rank || '-'}
                        </td>
                        <td className="px-3 py-3">
                          <Link href={`/coin/${coin.id}`} className="flex items-center gap-3 group">
                            {coin.image ? (
                              <img src={coin.image} alt={coin.name} className="w-8 h-8 rounded-full" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-[var(--surface-hover)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)]">
                                {coin.symbol.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors text-sm">
                                {coin.name}
                              </p>
                              <p className="text-xs text-[var(--text-muted)]">
                                {coin.symbol.toUpperCase()}
                              </p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-right text-sm font-medium text-[var(--text-primary)] tabular-nums">
                          ${coin.current_price.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: coin.current_price < 1 ? 6 : 2,
                          })}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span
                            className={`inline-flex items-center gap-1 text-sm font-medium ${
                              change24h >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'
                            }`}
                          >
                            {change24h >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                            {Math.abs(change24h).toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right hidden md:table-cell">
                          <span className={`text-sm font-medium ${change7d >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
                            {change7d >= 0 ? '+' : ''}{change7d.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right hidden sm:table-cell">
                          {sparklineData && sparklineData.length > 1 ? (
                            <Sparkline data={sparklineData} width={80} height={28} isPositive={change7d >= 0} />
                          ) : (
                            <span className="text-xs text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right hidden lg:table-cell text-sm text-[var(--text-secondary)] tabular-nums">
                          ${(coin.market_cap / 1e9).toFixed(2)}B
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/coin/${coin.id}#alerts`}
                              className="p-2 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
                              title="Set alert"
                            >
                              <Bell className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => {
                                removeFromWatchlist(coin.id);
                                addToast({ type: 'info', title: 'Removed from watchlist', message: coin.name });
                              }}
                              className="p-2 rounded-lg hover:bg-[var(--loss)]/20 text-[var(--text-muted)] hover:text-[var(--loss)] transition-colors"
                              title="Remove from watchlist"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredCoins.length === 0 && searchQuery && (
              <div className="p-12 text-center">
                <Search className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
                <p className="text-[var(--text-muted)]">
                  No coins found matching &quot;{searchQuery}&quot;
                </p>
              </div>
            )}
          </div>
        )}

        {/* Card view empty */}
        {viewMode === 'card' && filteredCoins.length === 0 && searchQuery && (
          <div className="text-center py-12 bg-[var(--surface)] rounded-2xl border border-[var(--surface-border)] mb-6">
            <Search className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-[var(--text-muted)]">No coins matching &quot;{searchQuery}&quot;</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <p>Drag to reorder · Data refreshes every minute · Prices from CoinGecko</p>
          <button onClick={handleClearAll} className="text-[var(--loss)] hover:underline">
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
