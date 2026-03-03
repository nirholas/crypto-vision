'use client';

import { useEffect, useRef, memo } from 'react';

interface TradingViewWidgetProps {
  symbol: string;
  theme?: 'light' | 'dark';
  interval?: string;
  height?: number;
  width?: string | number;
  allowSymbolChange?: boolean;
  hideTopToolbar?: boolean;
  hideSideToolbar?: boolean;
  studies?: string[];
}

/**
 * TradingView Advanced Chart Widget
 * Embeds a professional trading chart with technical analysis tools
 */
function TradingViewWidget({
  symbol = 'BINANCE:BTCUSDT',
  theme = 'dark',
  interval = 'D',
  height = 500,
  width = '100%',
  allowSymbolChange = true,
  hideTopToolbar = false,
  hideSideToolbar = false,
  studies = [],
}: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Clear any existing widget
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    // Create the script element for TradingView
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: interval,
      timezone: 'Etc/UTC',
      theme: theme,
      style: '1',
      locale: 'en',
      enable_publishing: false,
      allow_symbol_change: allowSymbolChange,
      hide_top_toolbar: hideTopToolbar,
      hide_side_toolbar: hideSideToolbar,
      calendar: false,
      support_host: 'https://www.tradingview.com',
      studies: studies.length > 0 ? studies : [
        'MASimple@tv-basicstudies',
        'RSI@tv-basicstudies',
        'MACD@tv-basicstudies',
      ],
    });

    // Append script to container
    if (containerRef.current) {
      containerRef.current.appendChild(script);
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, theme, interval, allowSymbolChange, hideTopToolbar, hideSideToolbar, studies]);

  return (
    <div className="tradingview-widget-container" style={{ height, width }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
      <div className="tradingview-widget-copyright text-xs text-gray-500 dark:text-gray-400 mt-1">
        <a
          href={`https://www.tradingview.com/symbols/${symbol.replace(':', '-')}/`}
          rel="noopener noreferrer"
          target="_blank"
          className="hover:underline"
        >
          Track all markets on TradingView
        </a>
      </div>
    </div>
  );
}

export default memo(TradingViewWidget);
