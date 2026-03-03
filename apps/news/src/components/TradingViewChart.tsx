'use client';

import { useEffect, useRef, useState } from 'react';

interface TradingViewChartProps {
  symbol?: string;
  interval?: string;
  theme?: 'light' | 'dark';
  autosize?: boolean;
  width?: number;
  height?: number;
  style?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
  timezone?: string;
  locale?: string;
  toolbar_bg?: string;
  enable_publishing?: boolean;
  hide_top_toolbar?: boolean;
  hide_legend?: boolean;
  save_image?: boolean;
  container_id?: string;
  studies?: string[];
}

/**
 * TradingView Advanced Chart Widget
 * 
 * Embeds a TradingView chart with customizable options.
 * Uses the TradingView widget library.
 * 
 * @example
 * <TradingViewChart symbol="BINANCE:BTCUSDT" theme="dark" />
 */
export function TradingViewChart({
  symbol = 'BINANCE:BTCUSDT',
  interval = 'D',
  theme = 'dark',
  autosize = true,
  width = 800,
  height = 500,
  style = '1',
  timezone = 'Etc/UTC',
  locale = 'en',
  toolbar_bg = '#f1f3f6',
  enable_publishing = false,
  hide_top_toolbar = false,
  hide_legend = false,
  save_image = true,
  container_id = 'tradingview_chart',
  studies = [],
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load TradingView widget script
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => setIsLoaded(true);
    document.head.appendChild(script);

    return () => {
      // Cleanup
      const existingScript = document.querySelector('script[src="https://s3.tradingview.com/tv.js"]');
      if (existingScript) {
        // Don't remove - might be used by other charts
      }
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !containerRef.current) return;

    // Clear previous chart
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    // Create new TradingView widget
    const TradingView = (window as unknown as { TradingView: unknown }).TradingView as {
      widget: new (config: Record<string, unknown>) => unknown;
    };

    if (TradingView) {
      new TradingView.widget({
        symbol,
        interval,
        theme,
        autosize,
        width: autosize ? undefined : width,
        height: autosize ? undefined : height,
        style,
        timezone,
        locale,
        toolbar_bg,
        enable_publishing,
        hide_top_toolbar,
        hide_legend,
        save_image,
        container_id,
        studies,
        withdateranges: true,
        allow_symbol_change: true,
        details: true,
        hotlist: true,
        calendar: true,
        news: ['headlines'],
      });
    }
  }, [
    isLoaded,
    symbol,
    interval,
    theme,
    autosize,
    width,
    height,
    style,
    timezone,
    locale,
    toolbar_bg,
    enable_publishing,
    hide_top_toolbar,
    hide_legend,
    save_image,
    container_id,
    studies,
  ]);

  return (
    <div className="relative w-full">
      {!isLoaded && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 rounded-xl"
          style={{ height: autosize ? '500px' : `${height}px` }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-neutral-500">Loading chart...</span>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        id={container_id}
        className="rounded-xl overflow-hidden"
        style={{ 
          height: autosize ? '500px' : `${height}px`,
          width: autosize ? '100%' : `${width}px`,
        }}
      />
    </div>
  );
}

/**
 * TradingView Mini Chart Widget
 * 
 * Smaller, simpler chart for sidebars and cards.
 */
interface MiniChartProps {
  symbol?: string;
  theme?: 'light' | 'dark';
  width?: number | string;
  height?: number;
  isTransparent?: boolean;
  colorTheme?: 'light' | 'dark';
  dateRange?: '1D' | '1M' | '3M' | '12M' | '60M' | 'ALL';
}

export function TradingViewMiniChart({
  symbol = 'BINANCE:BTCUSDT',
  theme = 'dark',
  width = '100%',
  height = 220,
  isTransparent = false,
  dateRange = '12M',
}: MiniChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerId = `tv_mini_${symbol.replace(/[^a-zA-Z0-9]/g, '_')}`;

  useEffect(() => {
    if (!containerRef.current) return;

    // Create widget script
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol,
      width,
      height,
      locale: 'en',
      dateRange,
      colorTheme: theme,
      isTransparent,
      autosize: false,
      largeChartUrl: '',
    });

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(script);
  }, [symbol, width, height, theme, isTransparent, dateRange]);

  return (
    <div 
      ref={containerRef}
      id={containerId}
      className="tradingview-widget-container rounded-lg overflow-hidden"
    />
  );
}

/**
 * TradingView Ticker Tape Widget
 * 
 * Scrolling price ticker for multiple symbols.
 */
interface TickerTapeProps {
  symbols?: { proName: string; title: string }[];
  colorTheme?: 'light' | 'dark';
  isTransparent?: boolean;
  displayMode?: 'adaptive' | 'regular' | 'compact';
  showSymbolLogo?: boolean;
}

export function TradingViewTickerTape({
  symbols = [
    { proName: 'BINANCE:BTCUSDT', title: 'Bitcoin' },
    { proName: 'BINANCE:ETHUSDT', title: 'Ethereum' },
    { proName: 'BINANCE:SOLUSDT', title: 'Solana' },
    { proName: 'BINANCE:BNBUSDT', title: 'BNB' },
    { proName: 'BINANCE:XRPUSDT', title: 'XRP' },
    { proName: 'BINANCE:ADAUSDT', title: 'Cardano' },
  ],
  colorTheme = 'dark',
  isTransparent = false,
  displayMode = 'adaptive',
  showSymbolLogo = true,
}: TickerTapeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols,
      showSymbolLogo,
      colorTheme,
      isTransparent,
      displayMode,
      locale: 'en',
    });

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(script);
  }, [symbols, showSymbolLogo, colorTheme, isTransparent, displayMode]);

  return (
    <div 
      ref={containerRef}
      className="tradingview-widget-container"
    />
  );
}

/**
 * TradingView Market Overview Widget
 * 
 * Shows market overview with crypto, stocks, forex tabs.
 */
interface MarketOverviewProps {
  colorTheme?: 'light' | 'dark';
  height?: number;
  width?: string;
  showFloatingTooltip?: boolean;
}

export function TradingViewMarketOverview({
  colorTheme = 'dark',
  height = 400,
  width = '100%',
  showFloatingTooltip = true,
}: MarketOverviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      colorTheme,
      dateRange: '12M',
      showChart: true,
      locale: 'en',
      width,
      height,
      largeChartUrl: '',
      isTransparent: false,
      showSymbolLogo: true,
      showFloatingTooltip,
      tabs: [
        {
          title: 'Crypto',
          symbols: [
            { s: 'BINANCE:BTCUSDT', d: 'Bitcoin' },
            { s: 'BINANCE:ETHUSDT', d: 'Ethereum' },
            { s: 'BINANCE:SOLUSDT', d: 'Solana' },
            { s: 'BINANCE:BNBUSDT', d: 'BNB' },
            { s: 'BINANCE:XRPUSDT', d: 'XRP' },
            { s: 'BINANCE:ADAUSDT', d: 'Cardano' },
          ],
          originalTitle: 'Crypto',
        },
      ],
    });

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(script);
  }, [colorTheme, height, width, showFloatingTooltip]);

  return (
    <div 
      ref={containerRef}
      className="tradingview-widget-container rounded-xl overflow-hidden"
      style={{ height }}
    />
  );
}

export default TradingViewChart;
