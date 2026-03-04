'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Scale,
  Plus,
  X,
  Search,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  Share2,
} from 'lucide-react';
import { getTopCoins, getHistoricalPrices, TokenPrice } from '@/lib/market-data';
import { useToast } from '@/components/Toast';

const POPULAR_COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche' },
  { id: 'polygon', symbol: 'MATIC', name: 'Polygon' },
];

const MAX_COMPARE = 5;

interface CoinData extends TokenPrice {
  historicalPrices?: [number, number][];
}

type TimeRange = '24h' | '7d' | '30d' | '90d' | '1y';

function ComparePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  const [selectedCoins, setSelectedCoins] = useState<string[]>([]);
  const [coinData, setCoinData] = useState<Map<string, CoinData>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCoinSelector, setShowCoinSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [allCoins, setAllCoins] = useState<TokenPrice[]>([]);

  // Parse coins from URL
  useEffect(() => {
    const coinsParam = searchParams.get('coins');
    if (coinsParam) {
      const coins = coinsParam.split(',').slice(0, MAX_COMPARE);
      setSelectedCoins(coins);
    } else {
      // Default comparison
      setSelectedCoins(['bitcoin', 'ethereum']);
    }
  }, [searchParams]);

  // Fetch all coins for selector
  useEffect(() => {
    async function fetchAllCoins() {
      try {
        const coins = await getTopCoins(100);
        setAllCoins(coins);
      } catch (err) {
        console.error('Failed to fetch coins:', err);
      }
    }
    fetchAllCoins();
  }, []);

  // Fetch coin data
  const fetchCoinData = useCallback(async () => {
    if (selectedCoins.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const coins = await getTopCoins(250);
      const coinMap = new Map(coins.map((c) => [c.id, c]));
      const newCoinData = new Map<string, CoinData>();

      for (const coinId of selectedCoins) {
        const coin = coinMap.get(coinId);
        if (coin) {
          try {
            const days =
              timeRange === '24h'
                ? 1
                : timeRange === '7d'
                  ? 7
                  : timeRange === '30d'
                    ? 30
                    : timeRange === '90d'
                      ? 90
                      : 365;
            const historical = await getHistoricalPrices(coinId, days);
            newCoinData.set(coinId, {
              ...coin,
              historicalPrices: historical?.prices,
            });
          } catch {
            newCoinData.set(coinId, coin);
          }
        }
      }

      setCoinData(newCoinData);
    } catch (err) {
      console.error('Failed to fetch coin data:', err);
      setError('Failed to load coin data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCoins, timeRange]);

  useEffect(() => {
    fetchCoinData();
  }, [fetchCoinData]);

  // Update URL when coins change
  useEffect(() => {
    if (selectedCoins.length > 0) {
      const newUrl = `/compare?coins=${selectedCoins.join(',')}`;
      window.history.replaceState(null, '', newUrl);
    }
  }, [selectedCoins]);

  const addCoin = (coinId: string) => {
    if (selectedCoins.includes(coinId)) {
      addToast({ type: 'warning', title: 'Already comparing this coin' });
      return;
    }
    if (selectedCoins.length >= MAX_COMPARE) {
      addToast({ type: 'error', title: `Maximum ${MAX_COMPARE} coins can be compared` });
      return;
    }
    setSelectedCoins((prev) => [...prev, coinId]);
    setShowCoinSelector(false);
    setSearchQuery('');
  };

  const removeCoin = (coinId: string) => {
    setSelectedCoins((prev) => prev.filter((id) => id !== coinId));
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    addToast({ type: 'success', title: 'Link copied to clipboard' });
  };

  // Filter coins for selector
  const filteredCoins = searchQuery
    ? allCoins
        .filter(
          (c) =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.symbol.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .filter((c) => !selectedCoins.includes(c.id))
    : POPULAR_COINS.filter((c) => !selectedCoins.includes(c.id));

  // Get coin info from data or fallback
  const getCoinInfo = (coinId: string) => {
    const data = coinData.get(coinId);
    if (data) return data;
    const popular = POPULAR_COINS.find((c) => c.id === coinId);
    return popular ? { ...popular, current_price: 0 } : null;
  };

  // Calculate normalized prices for chart (all starting from 100)
  const normalizedData = React.useMemo(() => {
    const result: { timestamp: number; [coinId: string]: number }[] = [];

    // Find common timestamps across all coins
    const allTimestamps = new Set<number>();
    selectedCoins.forEach((coinId) => {
      const coin = coinData.get(coinId);
      coin?.historicalPrices?.forEach(([ts]) => allTimestamps.add(ts));
    });

    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    sortedTimestamps.forEach((timestamp) => {
      const point: { timestamp: number; [coinId: string]: number } = { timestamp };
      selectedCoins.forEach((coinId) => {
        const coin = coinData.get(coinId);
        const prices = coin?.historicalPrices;
        if (!prices || prices.length === 0) return;

        // Find closest price to this timestamp
        const closest = prices.reduce((prev, curr) =>
          Math.abs(curr[0] - timestamp) < Math.abs(prev[0] - timestamp) ? curr : prev
        );

        // Normalize: (current / first) * 100
        const firstPrice = prices[0][1];
        if (firstPrice > 0) {
          point[coinId] = (closest[1] / firstPrice) * 100;
        }
      });

      if (Object.keys(point).length > 1) {
        result.push(point);
      }
    });

    return result;
  }, [coinData, selectedCoins]);

  // Colors for different coins (monochrome shades)
  const colors = ['#171717', '#404040', '#737373', '#a3a3a3', '#d4d4d4'];

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Scale className="w-8 h-8 text-text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-text-primary">Compare</h1>
              <p className="text-text-muted">Compare cryptocurrency performance</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchCoinData}
              className="p-2 rounded-lg hover:bg-surface-alt text-text-muted transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 bg-surface-alt hover:bg-surface-alt rounded-lg text-text-secondary font-medium transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>
        </div>

        {/* Coin Selector */}
        <div className="bg-surface rounded-2xl border border-surface-border p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            {selectedCoins.map((coinId, index) => {
              const coin = getCoinInfo(coinId);
              return (
                <div
                  key={coinId}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-alt"
                  style={{ borderLeft: `4px solid ${colors[index % colors.length]}` }}
                >
                  {coin && (
                    <>
                      <span className="font-medium text-text-primary">
                        {(coin as TokenPrice).symbol?.toUpperCase() || coinId}
                      </span>
                      {selectedCoins.length > 1 && (
                        <button
                          onClick={() => removeCoin(coinId)}
                          className="p-1 rounded-full hover:bg-surface-alt text-text-muted"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {selectedCoins.length < MAX_COMPARE && (
              <div className="relative">
                <button
                  onClick={() => setShowCoinSelector(!showCoinSelector)}
                  className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-surface-border rounded-xl hover:border-surface-border text-text-muted transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add coin
                </button>

                {showCoinSelector && (
                  <div className="absolute top-full left-0 mt-2 w-72 bg-surface rounded-xl border border-surface-border shadow-xl z-10">
                    <div className="p-3 border-b border-surface-border">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search coins..."
                          className="w-full pl-9 pr-4 py-2 rounded-lg border border-surface-border bg-surface text-text-primary text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="p-2">
                      {filteredCoins.slice(0, 6).map((coin) => (
                        <button
                          key={coin.id}
                          onClick={() => addCoin(coin.id)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-alt transition-colors text-left"
                        >
                          {(coin as TokenPrice).image ? (
                            <img
                              src={(coin as TokenPrice).image}
                              alt={coin.name}
                              className="w-6 h-6 rounded-full"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-surface-alt" />
                          )}
                          <div>
                            <p className="font-medium text-text-primary text-sm">{coin.name}</p>
                            <p className="text-xs text-text-muted">{coin.symbol.toUpperCase()}</p>
                          </div>
                        </button>
                      ))}
                      {filteredCoins.length > 6 && (
                        <p className="text-center py-2 text-text-muted text-xs">Type to search {filteredCoins.length - 6} more coins...</p>
                      )}
                      {filteredCoins.length === 0 && (
                        <p className="text-center py-4 text-text-muted text-sm">No coins found</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Time Range Selector */}
            <div className="ml-auto flex items-center gap-1 bg-surface-alt rounded-lg p-1">
              {(['24h', '7d', '30d', '90d', '1y'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    timeRange === range
                      ? 'bg-surface text-text-primary shadow'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-surface-alt border border-surface-border rounded-xl flex items-center gap-3 text-text-secondary">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
            <button onClick={fetchCoinData} className="ml-auto text-sm font-medium underline">
              Retry
            </button>
          </div>
        )}

        {/* Chart Placeholder */}
        <div className="bg-surface rounded-2xl border border-surface-border p-6 mb-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Normalized Price Chart</h2>
          <p className="text-sm text-text-muted mb-4">
            All prices normalized to 100 at the start of the period to show relative performance
          </p>

          {isLoading ? (
            <div className="h-80 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-text-muted animate-spin" />
            </div>
          ) : normalizedData.length > 0 ? (
            <div className="h-80 flex items-center justify-center bg-surface-alt rounded-xl">
              {/* Simple visual representation */}
              <div className="text-center">
                <p className="text-text-muted mb-4">
                  Chart data loaded for {selectedCoins.length} coin
                  {selectedCoins.length !== 1 ? 's' : ''}
                </p>
                <div className="flex justify-center gap-4">
                  {selectedCoins.map((coinId, index) => {
                    const coin = coinData.get(coinId);
                    if (!coin?.historicalPrices) return null;
                    const firstPrice = coin.historicalPrices[0]?.[1] || 0;
                    const lastPrice =
                      coin.historicalPrices[coin.historicalPrices.length - 1]?.[1] || 0;
                    const change =
                      firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

                    return (
                      <div key={coinId} className="text-center">
                        <div
                          className="w-3 h-20 mx-auto rounded-full"
                          style={{
                            backgroundColor: colors[index % colors.length],
                            opacity: 0.7,
                          }}
                        />
                        <p className="text-xs text-text-muted mt-2">{coin.symbol.toUpperCase()}</p>
                        <p
                          className={`text-xs font-medium ${
                            change >= 0 ? 'text-text-primary' : 'text-text-muted'
                          }`}
                        >
                          {change >= 0 ? '+' : ''}
                          {change.toFixed(1)}%
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center text-text-muted">
              No data available
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4">
            {selectedCoins.map((coinId, index) => {
              const coin = coinData.get(coinId);
              return (
                <div key={coinId} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: colors[index % colors.length] }}
                  />
                  <span className="text-sm text-text-secondary">{coin?.name || coinId}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Comparison Table */}
        <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-text-muted">
                    Metric
                  </th>
                  {selectedCoins.map((coinId, index) => {
                    const coin = coinData.get(coinId);
                    return (
                      <th
                        key={coinId}
                        className="px-4 py-4 text-right text-sm font-semibold"
                        style={{ color: colors[index % colors.length] }}
                      >
                        {coin?.symbol.toUpperCase() || coinId}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Price */}
                <tr className="border-b border-surface-border">
                  <td className="px-6 py-4 text-sm text-text-secondary">Price</td>
                  {selectedCoins.map((coinId) => {
                    const coin = coinData.get(coinId);
                    return (
                      <td
                        key={coinId}
                        className="px-4 py-4 text-right font-medium text-text-primary"
                      >
                        $
                        {coin?.current_price.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits:
                            coin?.current_price && coin.current_price < 1 ? 6 : 2,
                        }) || '-'}
                      </td>
                    );
                  })}
                </tr>

                {/* Market Cap */}
                <tr className="border-b border-surface-border">
                  <td className="px-6 py-4 text-sm text-text-secondary">Market Cap</td>
                  {selectedCoins.map((coinId) => {
                    const coin = coinData.get(coinId);
                    const mcap = coin?.market_cap || 0;
                    return (
                      <td key={coinId} className="px-4 py-4 text-right text-text-secondary">
                        {mcap >= 1e12
                          ? `$${(mcap / 1e12).toFixed(2)}T`
                          : mcap >= 1e9
                            ? `$${(mcap / 1e9).toFixed(2)}B`
                            : mcap >= 1e6
                              ? `$${(mcap / 1e6).toFixed(2)}M`
                              : '-'}
                      </td>
                    );
                  })}
                </tr>

                {/* 24h Change */}
                <tr className="border-b border-surface-border">
                  <td className="px-6 py-4 text-sm text-text-secondary">24h Change</td>
                  {selectedCoins.map((coinId) => {
                    const coin = coinData.get(coinId);
                    const change = coin?.price_change_percentage_24h || 0;
                    return (
                      <td key={coinId} className="px-4 py-4 text-right">
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            change >= 0 ? 'text-text-primary' : 'text-text-muted'
                          }`}
                        >
                          {change >= 0 ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                          {Math.abs(change).toFixed(2)}%
                        </span>
                      </td>
                    );
                  })}
                </tr>

                {/* 7d Change */}
                <tr className="border-b border-surface-border">
                  <td className="px-6 py-4 text-sm text-text-secondary">7d Change</td>
                  {selectedCoins.map((coinId) => {
                    const coin = coinData.get(coinId);
                    const change = coin?.price_change_percentage_7d_in_currency || 0;
                    return (
                      <td key={coinId} className="px-4 py-4 text-right">
                        <span
                          className={`font-medium ${
                            change >= 0 ? 'text-text-primary' : 'text-text-muted'
                          }`}
                        >
                          {change >= 0 ? '+' : ''}
                          {change.toFixed(2)}%
                        </span>
                      </td>
                    );
                  })}
                </tr>

                {/* ATH */}
                <tr className="border-b border-surface-border">
                  <td className="px-6 py-4 text-sm text-text-secondary">All-Time High</td>
                  {selectedCoins.map((coinId) => {
                    const coin = coinData.get(coinId);
                    return (
                      <td key={coinId} className="px-4 py-4 text-right text-text-secondary">
                        $
                        {coin?.ath?.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: coin?.ath && coin.ath < 1 ? 6 : 2,
                        }) || '-'}
                      </td>
                    );
                  })}
                </tr>

                {/* From ATH */}
                <tr className="border-b border-surface-border">
                  <td className="px-6 py-4 text-sm text-text-secondary">From ATH</td>
                  {selectedCoins.map((coinId) => {
                    const coin = coinData.get(coinId);
                    const change = coin?.ath_change_percentage || 0;
                    return (
                      <td key={coinId} className="px-4 py-4 text-right">
                        <span className="text-text-muted font-medium">{change.toFixed(1)}%</span>
                      </td>
                    );
                  })}
                </tr>

                {/* Volume */}
                <tr className="border-b border-surface-border">
                  <td className="px-6 py-4 text-sm text-text-secondary">24h Volume</td>
                  {selectedCoins.map((coinId) => {
                    const coin = coinData.get(coinId);
                    const vol = coin?.total_volume || 0;
                    return (
                      <td key={coinId} className="px-4 py-4 text-right text-text-secondary">
                        {vol >= 1e9
                          ? `$${(vol / 1e9).toFixed(2)}B`
                          : vol >= 1e6
                            ? `$${(vol / 1e6).toFixed(2)}M`
                            : '-'}
                      </td>
                    );
                  })}
                </tr>

                {/* Circulating Supply */}
                <tr>
                  <td className="px-6 py-4 text-sm text-text-secondary">Circulating Supply</td>
                  {selectedCoins.map((coinId) => {
                    const coin = coinData.get(coinId);
                    const supply = coin?.circulating_supply || 0;
                    return (
                      <td key={coinId} className="px-4 py-4 text-right text-text-secondary">
                        {supply >= 1e9
                          ? `${(supply / 1e9).toFixed(2)}B`
                          : supply >= 1e6
                            ? `${(supply / 1e6).toFixed(2)}M`
                            : supply.toLocaleString()}{' '}
                        {coin?.symbol.toUpperCase()}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Click outside to close coin selector */}
      {showCoinSelector && (
        <div className="fixed inset-0 z-0" onClick={() => setShowCoinSelector(false)} />
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="animate-pulse space-y-6">
              <div className="h-12 bg-surface-alt rounded-lg w-48" />
              <div className="h-20 bg-surface-alt rounded-2xl" />
              <div className="h-80 bg-surface-alt rounded-2xl" />
              <div className="h-96 bg-surface-alt rounded-2xl" />
            </div>
          </div>
        </div>
      }
    >
      <ComparePageContent />
    </Suspense>
  );
}
