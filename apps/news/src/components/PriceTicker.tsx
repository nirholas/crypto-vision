/**
 * Live Price Ticker Bar
 * Displays BTC, ETH, SOL prices with 24h change
 */

import { getSimplePrices, getFearGreedIndex, formatPrice, formatPercent, getFearGreedColor } from '@/lib/market-data';

interface PriceTickerProps {
  className?: string;
}

export default async function PriceTicker({ className = '' }: PriceTickerProps) {
  const [prices, fearGreed] = await Promise.all([
    getSimplePrices(),
    getFearGreedIndex(),
  ]);

  const coins = [
    { 
      symbol: 'BTC', 
      name: 'Bitcoin',
      icon: '₿',
      color: 'text-orange-400',
      price: prices.bitcoin?.usd,
      change: prices.bitcoin?.usd_24h_change,
    },
    { 
      symbol: 'ETH', 
      name: 'Ethereum',
      icon: 'Ξ',
      color: 'text-purple-400',
      price: prices.ethereum?.usd,
      change: prices.ethereum?.usd_24h_change,
    },
    { 
      symbol: 'SOL', 
      name: 'Solana',
      icon: '◎',
      color: 'text-gradient-to-r from-purple-400 to-green-400',
      price: prices.solana?.usd,
      change: prices.solana?.usd_24h_change,
    },
  ];

  return (
    <div 
      className={`bg-gray-900 text-white py-2.5 overflow-hidden ${className}`}
      role="region"
      aria-label="Cryptocurrency prices"
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between gap-6 text-sm overflow-x-auto scrollbar-hide">
          {/* Price Tickers */}
          <div className="flex items-center gap-6" role="list" aria-label="Current prices">
            {coins.map((coin) => {
              const isPositive = (coin.change || 0) >= 0;
              return (
                <div 
                  key={coin.symbol} 
                  className="flex items-center gap-2 whitespace-nowrap"
                  role="listitem"
                >
                  <span className={coin.color} aria-hidden="true">{coin.icon}</span>
                  <span className="text-gray-400 font-medium">{coin.symbol}</span>
                  <span className="font-semibold">{formatPrice(coin.price)}</span>
                  <span 
                    className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                      isPositive ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {/* Arrow indicator */}
                    <svg 
                      className={`w-3 h-3 ${isPositive ? '' : 'rotate-180'}`} 
                      fill="currentColor" 
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <span aria-label={`${coin.name} ${isPositive ? 'up' : 'down'} ${Math.abs(coin.change || 0).toFixed(2)} percent in 24 hours`}>
                      {formatPercent(coin.change)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* Fear & Greed Index */}
          {fearGreed && (
            <div 
              className="flex items-center gap-2 whitespace-nowrap border-l border-gray-700 pl-6"
              aria-label={`Fear and Greed Index: ${fearGreed.value}, ${fearGreed.value_classification}`}
            >
              <span className="text-gray-400 text-xs uppercase tracking-wide">Fear & Greed</span>
              <span className={`font-bold ${getFearGreedColor(Number(fearGreed.value))}`}>
                {fearGreed.value}
              </span>
              <span className="text-gray-500 text-xs hidden sm:inline">
                ({fearGreed.value_classification})
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
