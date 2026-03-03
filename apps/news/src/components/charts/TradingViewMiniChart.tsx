'use client';

import { useEffect, useRef, memo } from 'react';

interface TradingViewMiniChartProps {
  symbol: string;
  theme?: 'light' | 'dark';
  width?: string | number;
  height?: number;
  dateRange?: '1D' | '1M' | '3M' | '12M' | '60M' | 'ALL';
  colorTheme?: 'light' | 'dark';
  isTransparent?: boolean;
  autosize?: boolean;
  largeChartUrl?: string;
}

/**
 * TradingView Mini Chart Widget
 * Compact chart for quick price overview
 */
function TradingViewMiniChart({
  symbol = 'BINANCE:BTCUSDT',
  theme = 'dark',
  width = '100%',
  height = 220,
  dateRange = '1M',
  isTransparent = true,
  autosize = true,
  largeChartUrl = '',
}: TradingViewMiniChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: symbol,
      width: autosize ? '100%' : width,
      height: height,
      locale: 'en',
      dateRange: dateRange,
      colorTheme: theme,
      isTransparent: isTransparent,
      autosize: autosize,
      largeChartUrl: largeChartUrl || '',
    });

    if (containerRef.current) {
      containerRef.current.appendChild(script);
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, theme, width, height, dateRange, isTransparent, autosize, largeChartUrl]);

  return (
    <div 
      className="tradingview-widget-container" 
      style={{ height, width: autosize ? '100%' : width }}
    >
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}

export default memo(TradingViewMiniChart);
