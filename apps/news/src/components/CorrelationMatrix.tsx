'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowPathIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface CoinHistory {
  id: string;
  symbol: string;
  name: string;
  prices: number[];
}

const TOP_COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche' },
];

// Pearson correlation coefficient calculation
function calculateCorrelation(arr1: number[], arr2: number[]): number {
  const n = Math.min(arr1.length, arr2.length);
  if (n < 2) return 0;

  // Calculate returns (% change) instead of raw prices for better correlation
  const returns1 = [];
  const returns2 = [];
  for (let i = 1; i < n; i++) {
    if (arr1[i - 1] !== 0 && arr2[i - 1] !== 0) {
      returns1.push((arr1[i] - arr1[i - 1]) / arr1[i - 1]);
      returns2.push((arr2[i] - arr2[i - 1]) / arr2[i - 1]);
    }
  }

  if (returns1.length < 2) return 0;

  const mean1 = returns1.reduce((a, b) => a + b, 0) / returns1.length;
  const mean2 = returns2.reduce((a, b) => a + b, 0) / returns2.length;

  let numerator = 0;
  let denom1 = 0;
  let denom2 = 0;

  for (let i = 0; i < returns1.length; i++) {
    const diff1 = returns1[i] - mean1;
    const diff2 = returns2[i] - mean2;
    numerator += diff1 * diff2;
    denom1 += diff1 * diff1;
    denom2 += diff2 * diff2;
  }

  const denominator = Math.sqrt(denom1 * denom2);
  return denominator === 0 ? 0 : numerator / denominator;
}

// Cache for historical data to avoid repeated API calls
const dataCache = new Map<string, { data: CoinHistory[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function fetchCoinHistory(coinId: string, days: number): Promise<number[] | null> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
      { 
        cache: 'force-cache',
        next: { revalidate: 300 } // 5 min cache
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        // Rate limited, wait and retry
        await new Promise(r => setTimeout(r, 1000));
        return fetchCoinHistory(coinId, days);
      }
      return null;
    }

    const data = await response.json();
    return data.prices?.map((p: number[]) => p[1]) || null;
  } catch (error) {
    console.error(`Failed to fetch ${coinId} history:`, error);
    return null;
  }
}

export function CorrelationMatrix() {
  const [coinData, setCoinData] = useState<CoinHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'7' | '30' | '90'>('30');
  const [hoveredCell, setHoveredCell] = useState<{ row: string; col: string } | null>(null);
  const [progress, setProgress] = useState<number>(0);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setProgress(0);

    const cacheKey = `correlation-${timeframe}`;
    const cached = dataCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setCoinData(cached.data);
      setLoading(false);
      setProgress(100);
      return;
    }

    try {
      const results: CoinHistory[] = [];
      
      // Fetch sequentially with delay to respect rate limits
      for (let i = 0; i < TOP_COINS.length; i++) {
        const coin = TOP_COINS[i];
        setProgress(Math.round((i / TOP_COINS.length) * 100));
        
        const prices = await fetchCoinHistory(coin.id, parseInt(timeframe));
        
        if (prices && prices.length > 1) {
          results.push({
            id: coin.id,
            symbol: coin.symbol,
            name: coin.name,
            prices,
          });
        }
        
        // Small delay between requests to avoid rate limiting
        if (i < TOP_COINS.length - 1) {
          await new Promise(r => setTimeout(r, 250));
        }
      }

      if (results.length < 2) {
        setError('Unable to fetch enough data for correlation analysis. CoinGecko may be rate limiting requests.');
        setCoinData([]);
      } else {
        setCoinData(results);
        dataCache.set(cacheKey, { data: results, timestamp: Date.now() });
        setError(null);
      }
    } catch (e) {
      console.error('Failed to fetch historical data:', e);
      setError('Failed to fetch market data. Please try again.');
    } finally {
      setLoading(false);
      setProgress(100);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const correlationMatrix = useMemo(() => {
    const matrix: Map<string, Map<string, number>> = new Map();

    coinData.forEach((coin1) => {
      const row = new Map<string, number>();
      coinData.forEach((coin2) => {
        const corr = coin1.id === coin2.id ? 1 : calculateCorrelation(coin1.prices, coin2.prices);
        row.set(coin2.id, corr);
      });
      matrix.set(coin1.id, row);
    });

    return matrix;
  }, [coinData]);

  // Statistics
  const stats = useMemo(() => {
    const correlations: number[] = [];
    const highlyCorrelated: Array<{ pair: string; corr: number }> = [];
    const inversePairs: Array<{ pair: string; corr: number }> = [];

    coinData.forEach((coin1, i) => {
      coinData.forEach((coin2, j) => {
        if (j > i) {
          const corr = correlationMatrix.get(coin1.id)?.get(coin2.id) || 0;
          correlations.push(corr);
          
          if (corr > 0.8) {
            highlyCorrelated.push({ pair: `${coin1.symbol}/${coin2.symbol}`, corr });
          }
          if (corr < -0.3) {
            inversePairs.push({ pair: `${coin1.symbol}/${coin2.symbol}`, corr });
          }
        }
      });
    });

    const avg = correlations.length > 0 
      ? correlations.reduce((a, b) => a + b, 0) / correlations.length 
      : 0;

    return {
      avgCorrelation: avg,
      highlyCorrelated: highlyCorrelated.sort((a, b) => b.corr - a.corr).slice(0, 5),
      inversePairs: inversePairs.sort((a, b) => a.corr - b.corr).slice(0, 3),
    };
  }, [coinData, correlationMatrix]);

  const getCorrelationColor = (corr: number): string => {
    // Monochrome gradient based on correlation
    // Highly correlated (1) = dark, Uncorrelated (0) = medium, Inverse (-1) = light
    const lightness = 50 - corr * 40; // Range: 10% to 90%
    return `hsl(0, 0%, ${Math.round(lightness)}%)`;
  };

  const getTextColor = (corr: number): string => {
    return corr > 0.3 ? 'text-white' : 'text-slate-900';
  };

  const formatCorrelation = (corr: number): string => {
    return corr.toFixed(2);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-center">
          <div className="inline-flex rounded-lg border border-gray-300 dark:border-slate-700 p-1 opacity-50">
            {(['7', '30', '90'] as const).map((tf) => (
              <button key={tf} disabled className="px-4 py-1.5 text-sm font-medium rounded-md text-gray-400">
                {tf}D
              </button>
            ))}
          </div>
        </div>
        
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-3">
            <ArrowPathIcon className="w-5 h-5 animate-spin text-gray-400" />
            <span className="text-gray-500 dark:text-gray-400">
              Loading historical data... {progress}%
            </span>
          </div>
          <div className="mt-4 w-64 mx-auto bg-gray-200 dark:bg-slate-700 rounded-full h-2">
            <div 
              className="bg-slate-900 dark:bg-white h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
        <button
          onClick={fetchAllData}
          className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg hover:opacity-90 transition-opacity"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (coinData.length < 2) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        Not enough data to display correlation matrix.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timeframe Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-gray-300 dark:border-slate-700 p-1">
          {(['7', '30', '90'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                timeframe === tf
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'text-gray-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tf}D
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
        <span className="text-gray-500 dark:text-gray-400">Inverse (-1)</span>
        <div className="flex h-4 rounded overflow-hidden">
          {Array.from({ length: 11 }).map((_, i) => (
            <div
              key={i}
              className="w-5"
              style={{ backgroundColor: getCorrelationColor(-1 + i * 0.2) }}
            />
          ))}
        </div>
        <span className="text-gray-500 dark:text-gray-400">Correlated (+1)</span>
      </div>

      {/* Insights */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Average Correlation</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {stats.avgCorrelation.toFixed(2)}
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Highly Correlated</div>
          <div className="text-sm text-slate-900 dark:text-white">
            {stats.highlyCorrelated.length > 0 
              ? stats.highlyCorrelated.slice(0, 2).map(p => `${p.pair} (${p.corr.toFixed(2)})`).join(', ')
              : 'None above 0.8'
            }
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Least Correlated</div>
          <div className="text-sm text-slate-900 dark:text-white">
            {stats.inversePairs.length > 0 
              ? stats.inversePairs.slice(0, 2).map(p => `${p.pair} (${p.corr.toFixed(2)})`).join(', ')
              : 'All positively correlated'
            }
          </div>
        </div>
      </div>

      {/* Matrix */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="p-2 min-w-[60px]"></th>
                {coinData.map((coin) => (
                  <th
                    key={coin.id}
                    className="p-2 text-xs font-medium text-gray-500 dark:text-gray-400"
                    title={coin.name}
                  >
                    {coin.symbol}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coinData.map((rowCoin) => (
                <tr key={rowCoin.id}>
                  <td 
                    className="p-2 text-xs font-medium text-gray-500 dark:text-gray-400 text-right"
                    title={rowCoin.name}
                  >
                    {rowCoin.symbol}
                  </td>
                  {coinData.map((colCoin) => {
                    const corr = correlationMatrix.get(rowCoin.id)?.get(colCoin.id) || 0;
                    const isHovered = 
                      hoveredCell?.row === rowCoin.id && hoveredCell?.col === colCoin.id;
                    const isDiagonal = rowCoin.id === colCoin.id;

                    return (
                      <td
                        key={colCoin.id}
                        className={`p-0 ${isDiagonal ? '' : 'cursor-pointer'}`}
                        onMouseEnter={() => !isDiagonal && setHoveredCell({ row: rowCoin.id, col: colCoin.id })}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <div
                          className={`w-12 h-12 flex items-center justify-center text-xs font-mono transition-all ${
                            getTextColor(corr)
                          } ${isHovered ? 'ring-2 ring-blue-500 z-10' : ''}`}
                          style={{ backgroundColor: getCorrelationColor(corr) }}
                          title={`${rowCoin.name} / ${colCoin.name}: ${formatCorrelation(corr)}`}
                        >
                          {formatCorrelation(corr)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interpretation Guide */}
      <div className="flex items-start gap-2 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg text-sm text-gray-600 dark:text-gray-400">
        <InformationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-900 dark:text-white">How to read:</strong> Correlation measures how assets move together. 
          Values near +1 mean assets move together, near -1 means they move oppositely, 
          and near 0 means no relationship. Based on {timeframe}-day price returns.
        </div>
      </div>

      {/* Data Attribution */}
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
        Historical price data from CoinGecko. Correlations calculated using daily returns over {timeframe} days.
      </p>
    </div>
  );
}
