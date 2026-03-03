'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePortfolio } from './PortfolioProvider';
import {
  getPortfolioSnapshots,
  calculatePerformanceMetrics,
  fetchHistoricalPrices,
  reconstructPortfolioHistory,
  usePortfolioHistoryTracker,
  type PortfolioSnapshot,
} from '@/lib/portfolio-history';

type TimeRange = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';

interface PerformanceChartProps {
  totalValue?: number;
  prices?: Record<string, number>;
}

/**
 * Enterprise-Grade Portfolio Performance Chart
 * 
 * Features:
 * - Real historical data from recorded snapshots
 * - Fallback to reconstructed history from transactions + CoinGecko prices
 * - Interactive hover with precise data points
 * - Performance metrics (change, high, low, volatility)
 * - Responsive SVG chart with gradient fills
 * - Automatic snapshot recording for future accuracy
 */
export function PerformanceChart({ totalValue: propTotalValue, prices = {} }: PerformanceChartProps) {
  const { holdings, transactions } = usePortfolio();
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chartData, setChartData] = useState<PortfolioSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Calculate current total value
  const totalValue = propTotalValue ?? holdings.reduce((sum, h) => {
    const price = prices[h.coinId] || 0;
    return sum + (h.amount * price);
  }, 0);

  // Track portfolio history automatically
  usePortfolioHistoryTracker(
    holdings.map(h => ({ coinId: h.coinId, coinSymbol: h.coinSymbol, amount: h.amount })),
    prices,
    isLoading
  );

  // Load chart data based on time range
  const loadChartData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // First, try to get recorded snapshots
      let snapshots = getPortfolioSnapshots(timeRange);

      // If we have few or no snapshots, reconstruct from transaction history
      const minSnapshots = timeRange === '1D' ? 6 : timeRange === '1W' ? 7 : 14;
      
      if (snapshots.length < minSnapshots && transactions.length > 0) {
        const days = {
          '1D': 1,
          '1W': 7,
          '1M': 30,
          '3M': 90,
          '1Y': 365,
          'ALL': 730,
        }[timeRange];

        // Get unique coin IDs from holdings
        const coinIds = [...new Set(holdings.map(h => h.coinId))];
        
        if (coinIds.length > 0) {
          // Fetch historical prices
          const priceHistory = await fetchHistoricalPrices(coinIds, days);
          
          // Reconstruct history
          const reconstructed = reconstructPortfolioHistory(
            transactions.map(tx => ({
              coinId: tx.coinId,
              coinSymbol: tx.coinSymbol,
              type: tx.type,
              amount: tx.amount,
              date: tx.date,
            })),
            priceHistory,
            days
          );

          // Merge with existing snapshots, preferring recorded over reconstructed
          if (reconstructed.length > 0) {
            const existingTimestamps = new Set(snapshots.map(s => Math.floor(s.timestamp / 86400000)));
            const newSnapshots = reconstructed.filter(
              s => !existingTimestamps.has(Math.floor(s.timestamp / 86400000))
            );
            snapshots = [...newSnapshots, ...snapshots].sort((a, b) => a.timestamp - b.timestamp);
          }
        }
      }

      // Add current value as the latest point if we have prices
      if (Object.keys(prices).length > 0 && holdings.length > 0) {
        const currentSnapshot: PortfolioSnapshot = {
          timestamp: Date.now(),
          totalValue,
          holdings: holdings.map(h => ({
            coinId: h.coinId,
            symbol: h.coinSymbol,
            amount: h.amount,
            price: prices[h.coinId] || 0,
            value: h.amount * (prices[h.coinId] || 0),
          })),
        };

        // Replace or add current snapshot
        if (snapshots.length > 0 && Date.now() - snapshots[snapshots.length - 1].timestamp < 3600000) {
          snapshots[snapshots.length - 1] = currentSnapshot;
        } else {
          snapshots.push(currentSnapshot);
        }
      }

      setChartData(snapshots);
    } catch (err) {
      console.error('Failed to load chart data:', err);
      setError('Failed to load performance data');
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, transactions, holdings, prices, totalValue]);

  useEffect(() => {
    loadChartData();
  }, [loadChartData]);

  // Calculate metrics
  const metrics = useMemo(() => calculatePerformanceMetrics(chartData), [chartData]);

  // Get hovered point data
  const hoveredPoint = hoveredIndex !== null ? chartData[hoveredIndex] : null;

  // Chart dimensions
  const chartHeight = 240;
  const padding = { top: 24, right: 16, bottom: 40, left: 72 };

  // Calculate scales
  const values = chartData.map(d => d.totalValue);
  const minValue = values.length > 0 ? Math.min(...values) * 0.98 : 0;
  const maxValue = values.length > 0 ? Math.max(...values) * 1.02 : 100;
  const valueRange = maxValue - minValue || 1;

  const isPositive = metrics.percentChange >= 0;

  // Generate path data
  const generatePath = () => {
    if (chartData.length < 2) return { line: '', area: '' };

    const chartWidth = 100 - (padding.left / 10) - (padding.right / 10);
    const chartHeightInner = chartHeight - padding.top - padding.bottom;

    const points = chartData.map((point, i) => {
      const x = padding.left / 10 + (i / (chartData.length - 1)) * chartWidth;
      const y = padding.top + (1 - (point.totalValue - minValue) / valueRange) * chartHeightInner;
      return { x, y };
    });

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x}% ${p.y}`).join(' ');
    const area = `${line} L ${points[points.length - 1].x}% ${chartHeight - padding.bottom} L ${points[0].x}% ${chartHeight - padding.bottom} Z`;

    return { line, area };
  };

  const { line: pathData, area: areaPath } = generatePath();

  // Format helpers
  const formatValue = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(2)}K`;
    return `$${val.toFixed(2)}`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    if (timeRange === '1D') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    if (timeRange === '1W' || timeRange === '1M') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  const formatPercent = (val: number) => {
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  };

  // Empty state
  if (holdings.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Portfolio Performance
        </h3>
        <div className="flex flex-col items-center justify-center h-48 text-gray-500 dark:text-slate-400">
          <svg className="w-12 h-12 mb-3 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          <p className="text-sm">Add holdings to track performance</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading && chartData.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-40 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-8 w-56 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
        <div className="h-48 bg-gray-100 dark:bg-slate-700/50 rounded-xl animate-pulse" />
      </div>
    );
  }

  // Insufficient data state
  if (chartData.length < 2) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Portfolio Performance
        </h3>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">Building Your History</p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Performance tracking has started. Check back in a few hours to see your portfolio chart. 
                Your value is automatically recorded every 4 hours.
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                Current value: <span className="font-semibold">{formatValue(totalValue)}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Portfolio Performance
          </h3>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatValue(hoveredPoint?.totalValue ?? totalValue)}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-sm font-medium ${
                isPositive
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}
            >
              {formatPercent(metrics.percentChange)}
            </span>
          </div>
          {hoveredPoint && (
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              {new Date(hoveredPoint.timestamp).toLocaleString()}
            </p>
          )}
        </div>

        {/* Time range selector */}
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
          {(['1D', '1W', '1M', '3M', '1Y', 'ALL'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                timeRange === range
                  ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide">High</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatValue(metrics.highValue)}</p>
        </div>
        <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide">Low</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatValue(metrics.lowValue)}</p>
        </div>
        <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide">Change</p>
          <p className={`text-sm font-semibold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatValue(Math.abs(metrics.absoluteChange))}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide">Volatility</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{metrics.volatility.toFixed(1)}%</p>
        </div>
      </div>

      {/* Chart */}
      <div className="relative" style={{ height: `${chartHeight}px` }}>
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-red-500">
            {error}
          </div>
        ) : (
          <svg
            className="w-full h-full"
            viewBox={`0 0 100 ${chartHeight}`}
            preserveAspectRatio="none"
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* Gradient definition */}
            <defs>
              <linearGradient id="performanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={isPositive ? '#22c55e' : '#ef4444'}
                  stopOpacity="0.25"
                />
                <stop
                  offset="100%"
                  stopColor={isPositive ? '#22c55e' : '#ef4444'}
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding.top + ratio * (chartHeight - padding.top - padding.bottom);
              const value = maxValue - ratio * valueRange;
              return (
                <g key={ratio}>
                  <line
                    x1={`${padding.left / 10}%`}
                    y1={y}
                    x2={`${100 - padding.right / 10}%`}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity="0.1"
                    className="text-gray-400 dark:text-slate-600"
                  />
                  <text
                    x={`${(padding.left / 10) - 1}%`}
                    y={y + 4}
                    textAnchor="end"
                    className="text-[7px] fill-gray-500 dark:fill-slate-400"
                  >
                    {formatValue(value)}
                  </text>
                </g>
              );
            })}

            {/* Area fill */}
            <path d={areaPath} fill="url(#performanceGradient)" />

            {/* Line */}
            <path
              d={pathData}
              fill="none"
              stroke={isPositive ? '#22c55e' : '#ef4444'}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              className="drop-shadow-sm"
            />

            {/* Interactive overlay */}
            {chartData.map((_, i) => {
              const chartWidth = 100 - (padding.left / 10) - (padding.right / 10);
              const x = padding.left / 10 + (i / (chartData.length - 1)) * chartWidth;
              const y = padding.top + (1 - (chartData[i].totalValue - minValue) / valueRange) * (chartHeight - padding.top - padding.bottom);
              
              return (
                <g
                  key={i}
                  onMouseEnter={() => setHoveredIndex(i)}
                  className="cursor-crosshair"
                >
                  <rect
                    x={`${x - 1}%`}
                    y={padding.top}
                    width="2%"
                    height={chartHeight - padding.top - padding.bottom}
                    fill="transparent"
                  />
                  {hoveredIndex === i && (
                    <>
                      <line
                        x1={`${x}%`}
                        y1={padding.top}
                        x2={`${x}%`}
                        y2={chartHeight - padding.bottom}
                        stroke="currentColor"
                        strokeOpacity="0.3"
                        strokeDasharray="3"
                        className="text-gray-400"
                      />
                      <circle
                        cx={`${x}%`}
                        cy={y}
                        r="5"
                        fill={isPositive ? '#22c55e' : '#ef4444'}
                        stroke="white"
                        strokeWidth="2"
                        className="drop-shadow-md"
                      />
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-slate-400" style={{ paddingLeft: `${padding.left / 10}%`, paddingRight: `${padding.right / 10}%` }}>
        {chartData
          .filter((_, i, arr) => {
            const step = Math.ceil(arr.length / 6);
            return i % step === 0 || i === arr.length - 1;
          })
          .map((point, i) => (
            <span key={i}>{formatDate(point.timestamp)}</span>
          ))}
      </div>

      {/* Loading overlay */}
      {isLoading && chartData.length > 0 && (
        <div className="absolute inset-0 bg-white/50 dark:bg-slate-800/50 flex items-center justify-center rounded-2xl">
          <div className="flex items-center gap-2 text-gray-500">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default PerformanceChart;
