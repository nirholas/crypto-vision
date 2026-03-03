'use client';

import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, AlertTriangle, Info } from 'lucide-react';
import { chartColors, colors } from '@/lib/colors';

interface CoinVolatility {
  id: string;
  name: string;
  symbol: string;
  volatility30d: number;
  volatility7d: number;
  maxDrawdown: number;
  sharpeRatio: number;
  beta: number;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
}

interface VolatilityAnalysisProps {
  coins?: CoinVolatility[];
  isLoading?: boolean;
}

// Default coins to fetch data for
const DEFAULT_COINS = ['bitcoin', 'ethereum', 'solana', 'cardano', 'ripple', 'dogecoin', 'polkadot', 'avalanche-2'];

/**
 * Calculate volatility from price history
 */
function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;
  
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }
  
  if (returns.length === 0) return 0;
  
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  // Annualize (assuming daily data)
  return stdDev * Math.sqrt(365) * 100;
}

/**
 * Calculate maximum drawdown from prices
 */
function calculateMaxDrawdown(prices: number[]): number {
  if (prices.length < 2) return 0;
  
  let maxPrice = prices[0];
  let maxDrawdown = 0;
  
  for (const price of prices) {
    if (price > maxPrice) maxPrice = price;
    const drawdown = ((price - maxPrice) / maxPrice) * 100;
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;
  }
  
  return maxDrawdown;
}

/**
 * Calculate Sharpe ratio (simplified using BTC as benchmark)
 */
function calculateSharpe(returns: number[], riskFreeRate: number = 0.04): number {
  if (returns.length < 2) return 0;
  
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return 0;
  
  // Annualized return minus risk-free rate, divided by annualized stdDev
  const annualizedReturn = mean * 365;
  return (annualizedReturn - riskFreeRate) / (stdDev * Math.sqrt(365));
}

/**
 * Determine risk level from volatility
 */
function getRiskLevel(volatility: number): 'low' | 'medium' | 'high' | 'extreme' {
  if (volatility < 40) return 'low';
  if (volatility < 60) return 'medium';
  if (volatility < 80) return 'high';
  return 'extreme';
}

const riskColors = {
  low: chartColors.gain,
  medium: colors.warning,
  high: chartColors.loss,
  extreme: '#FF4757',
};

const riskLabels = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
  extreme: 'Extreme Risk',
};

function VolatilityBar({ value, maxValue = 100 }: { value: number; maxValue?: number }) {
  const percentage = Math.min((value / maxValue) * 100, 100);
  const color = value < 40 ? chartColors.gain : value < 60 ? colors.warning : chartColors.loss;

  return (
    <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${percentage}%`, backgroundColor: color }}
      />
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  tooltip,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down' | 'neutral';
  tooltip?: string;
}) {
  return (
    <div className="bg-surface rounded-xl p-4 border border-surface-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-text-muted text-sm flex items-center gap-1">
          {title}
          {tooltip && (
            <span className="group relative cursor-help">
              <Info className="w-3 h-3" />
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-background text-text-primary text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                {tooltip}
              </span>
            </span>
          )}
        </span>
        <Icon className="w-4 h-4 text-text-muted" />
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-text-primary">{value}</span>
        {trend && trend !== 'neutral' && (
          <span className={trend === 'up' ? 'text-gain' : 'text-loss'}>
            {trend === 'up' ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
          </span>
        )}
      </div>
    </div>
  );
}

function RiskBadge({ level }: { level: CoinVolatility['riskLevel'] }) {
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: `${riskColors[level]}20`,
        color: riskColors[level],
      }}
    >
      {riskLabels[level]}
    </span>
  );
}

export default function VolatilityAnalysis({
  coins: propCoins,
  isLoading: propIsLoading = false,
}: VolatilityAnalysisProps) {
  const [coins, setCoins] = useState<CoinVolatility[]>(propCoins || []);
  const [isLoading, setIsLoading] = useState(!propCoins);
  const [sortBy, setSortBy] = useState<'volatility30d' | 'maxDrawdown' | 'sharpeRatio' | 'beta'>(
    'volatility30d'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fetch real volatility data from CoinGecko
  useEffect(() => {
    if (propCoins) {
      setCoins(propCoins);
      setIsLoading(false);
      return;
    }

    async function fetchVolatilityData() {
      setIsLoading(true);
      const results: CoinVolatility[] = [];
      
      // Fetch BTC first for beta calculation
      let btcReturns: number[] = [];
      try {
        const btcRes = await fetch(
          'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=30'
        );
        if (btcRes.ok) {
          const btcData = await btcRes.json();
          const btcPrices = btcData.prices?.map((p: [number, number]) => p[1]) || [];
          for (let i = 1; i < btcPrices.length; i++) {
            if (btcPrices[i - 1] > 0) {
              btcReturns.push((btcPrices[i] - btcPrices[i - 1]) / btcPrices[i - 1]);
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch BTC data for beta:', e);
      }

      for (const coinId of DEFAULT_COINS) {
        try {
          // Fetch 30 days of price data
          const res = await fetch(
            `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=30`
          );
          
          if (!res.ok) continue;
          
          const data = await res.json();
          const prices30d = data.prices?.map((p: [number, number]) => p[1]) || [];
          const prices7d = prices30d.slice(-7);
          
          // Calculate metrics
          const volatility30d = calculateVolatility(prices30d);
          const volatility7d = calculateVolatility(prices7d);
          const maxDrawdown = calculateMaxDrawdown(prices30d);
          
          // Calculate returns for Sharpe and Beta
          const returns: number[] = [];
          for (let i = 1; i < prices30d.length; i++) {
            if (prices30d[i - 1] > 0) {
              returns.push((prices30d[i] - prices30d[i - 1]) / prices30d[i - 1]);
            }
          }
          
          const sharpeRatio = calculateSharpe(returns);
          
          // Calculate Beta (covariance with BTC / variance of BTC)
          let beta = 1.0;
          if (btcReturns.length > 0 && returns.length > 0 && coinId !== 'bitcoin') {
            const minLen = Math.min(btcReturns.length, returns.length);
            const coinRet = returns.slice(-minLen);
            const btcRet = btcReturns.slice(-minLen);
            
            const coinMean = coinRet.reduce((a, b) => a + b, 0) / minLen;
            const btcMean = btcRet.reduce((a, b) => a + b, 0) / minLen;
            
            let covariance = 0;
            let btcVariance = 0;
            for (let i = 0; i < minLen; i++) {
              covariance += (coinRet[i] - coinMean) * (btcRet[i] - btcMean);
              btcVariance += Math.pow(btcRet[i] - btcMean, 2);
            }
            
            if (btcVariance > 0) {
              beta = covariance / btcVariance;
            }
          }
          
          // Get coin info
          const infoRes = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`);
          let name = coinId;
          let symbol = coinId.toUpperCase();
          if (infoRes.ok) {
            const info = await infoRes.json();
            name = info.name || coinId;
            symbol = info.symbol?.toUpperCase() || coinId.toUpperCase();
          }
          
          results.push({
            id: coinId,
            name,
            symbol,
            volatility30d: Math.round(volatility30d * 10) / 10,
            volatility7d: Math.round(volatility7d * 10) / 10,
            maxDrawdown: Math.round(maxDrawdown * 10) / 10,
            sharpeRatio: Math.round(sharpeRatio * 100) / 100,
            beta: Math.round(beta * 100) / 100,
            riskLevel: getRiskLevel(volatility30d),
          });
        } catch (e) {
          console.error(`Failed to fetch data for ${coinId}:`, e);
        }
      }
      
      setCoins(results);
      setIsLoading(false);
    }
    
    fetchVolatilityData();
  }, [propCoins]);

  const sortedCoins = useMemo(() => {
    return [...coins].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [coins, sortBy, sortOrder]);

  const avgVolatility = useMemo(() => {
    return (coins.reduce((sum, c) => sum + c.volatility30d, 0) / coins.length).toFixed(1);
  }, [coins]);

  const avgDrawdown = useMemo(() => {
    return (coins.reduce((sum, c) => sum + c.maxDrawdown, 0) / coins.length).toFixed(1);
  }, [coins]);

  const avgSharpe = useMemo(() => {
    return (coins.reduce((sum, c) => sum + c.sharpeRatio, 0) / coins.length).toFixed(2);
  }, [coins]);

  const highRiskCount = useMemo(() => {
    return coins.filter((c) => c.riskLevel === 'high' || c.riskLevel === 'extreme').length;
  }, [coins]);

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-surface rounded-2xl p-6 border border-surface-border">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-surface-hover rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-surface-hover rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-surface-hover rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-2xl p-6 border border-surface-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Volatility Analysis
          </h2>
          <p className="text-text-muted text-sm mt-1">
            Risk metrics and volatility indicators for top cryptocurrencies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-sm">Timeframe:</span>
          <select className="bg-surface-hover text-text-primary text-sm rounded-lg px-3 py-1.5 border border-surface-border focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="30d">30 Days</option>
            <option value="90d">90 Days</option>
            <option value="1y">1 Year</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Avg Volatility"
          value={`${avgVolatility}%`}
          icon={Activity}
          tooltip="Average 30-day annualized volatility"
        />
        <MetricCard
          title="Avg Max Drawdown"
          value={`${avgDrawdown}%`}
          icon={TrendingDown}
          tooltip="Average maximum peak-to-trough decline"
        />
        <MetricCard
          title="Avg Sharpe Ratio"
          value={avgSharpe}
          icon={TrendingUp}
          tooltip="Risk-adjusted return metric"
        />
        <MetricCard
          title="High Risk Assets"
          value={`${highRiskCount}/${coins.length}`}
          icon={AlertTriangle}
          tooltip="Assets with high or extreme risk levels"
        />
      </div>

      {/* Risk Distribution */}
      <div className="mb-6 p-4 bg-background rounded-xl">
        <h3 className="text-sm font-medium text-text-secondary mb-3">Risk Distribution</h3>
        <div className="flex gap-2">
          {(['low', 'medium', 'high', 'extreme'] as const).map((level) => {
            const count = coins.filter((c) => c.riskLevel === level).length;
            const percentage = (count / coins.length) * 100;
            return (
              <div
                key={level}
                className="flex-1 text-center p-2 rounded-lg"
                style={{ backgroundColor: `${riskColors[level]}15` }}
              >
                <div className="text-lg font-bold" style={{ color: riskColors[level] }}>
                  {count}
                </div>
                <div className="text-xs text-text-muted capitalize">{level}</div>
                <div
                  className="h-1 rounded-full mt-1"
                  style={{
                    backgroundColor: riskColors[level],
                    width: `${percentage}%`,
                    margin: '0 auto',
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Volatility Table */}
      <div className="overflow-x-auto scrollbar-hide">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-border">
              <th className="text-left py-3 px-4 text-text-muted text-sm font-medium">Asset</th>
              <th
                className="text-right py-3 px-4 text-text-muted text-sm font-medium cursor-pointer hover:text-text-primary transition-colors"
                onClick={() => handleSort('volatility30d')}
              >
                <span className="flex items-center justify-end gap-1">
                  30d Vol
                  {sortBy === 'volatility30d' && (
                    <span className="text-primary">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                  )}
                </span>
              </th>
              <th className="text-right py-3 px-4 text-text-muted text-sm font-medium hidden md:table-cell">
                7d Vol
              </th>
              <th
                className="text-right py-3 px-4 text-text-muted text-sm font-medium cursor-pointer hover:text-text-primary transition-colors"
                onClick={() => handleSort('maxDrawdown')}
              >
                <span className="flex items-center justify-end gap-1">
                  Max DD
                  {sortBy === 'maxDrawdown' && (
                    <span className="text-primary">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                  )}
                </span>
              </th>
              <th
                className="text-right py-3 px-4 text-text-muted text-sm font-medium cursor-pointer hover:text-text-primary transition-colors hidden lg:table-cell"
                onClick={() => handleSort('sharpeRatio')}
              >
                <span className="flex items-center justify-end gap-1">
                  Sharpe
                  {sortBy === 'sharpeRatio' && (
                    <span className="text-primary">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                  )}
                </span>
              </th>
              <th
                className="text-right py-3 px-4 text-text-muted text-sm font-medium cursor-pointer hover:text-text-primary transition-colors hidden lg:table-cell"
                onClick={() => handleSort('beta')}
              >
                <span className="flex items-center justify-end gap-1">
                  Beta
                  {sortBy === 'beta' && (
                    <span className="text-primary">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                  )}
                </span>
              </th>
              <th className="text-right py-3 px-4 text-text-muted text-sm font-medium">Risk</th>
            </tr>
          </thead>
          <tbody>
            {sortedCoins.map((coin, index) => (
              <tr
                key={coin.id}
                className="border-b border-surface-border hover:bg-surface-hover transition-colors"
              >
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center text-sm font-medium text-text-secondary">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-text-primary">{coin.name}</div>
                      <div className="text-text-muted text-sm">{coin.symbol}</div>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-medium text-text-primary">
                      {coin.volatility30d.toFixed(1)}%
                    </span>
                    <div className="w-20">
                      <VolatilityBar value={coin.volatility30d} />
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4 text-right text-text-secondary hidden md:table-cell">
                  {coin.volatility7d.toFixed(1)}%
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="text-loss font-medium">{coin.maxDrawdown.toFixed(1)}%</span>
                </td>
                <td className="py-4 px-4 text-right hidden lg:table-cell">
                  <span
                    className={
                      coin.sharpeRatio >= 1
                        ? 'text-gain'
                        : coin.sharpeRatio >= 0.5
                          ? 'text-text-secondary'
                          : 'text-loss'
                    }
                  >
                    {coin.sharpeRatio.toFixed(2)}
                  </span>
                </td>
                <td className="py-4 px-4 text-right text-text-secondary hidden lg:table-cell">
                  {coin.beta.toFixed(2)}
                </td>
                <td className="py-4 px-4 text-right">
                  <RiskBadge level={coin.riskLevel} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-surface-border">
        <div className="flex flex-wrap gap-4 text-xs text-text-muted">
          <span>
            <strong>Vol:</strong> Annualized volatility
          </span>
          <span>
            <strong>Max DD:</strong> Maximum drawdown from peak
          </span>
          <span>
            <strong>Sharpe:</strong> Risk-adjusted returns (higher is better)
          </span>
          <span>
            <strong>Beta:</strong> Correlation to BTC (1.0 = same as BTC)
          </span>
        </div>
      </div>
    </div>
  );
}
