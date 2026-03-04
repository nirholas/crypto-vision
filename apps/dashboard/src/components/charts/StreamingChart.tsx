/**
 * Real-time Streaming Price Chart
 * 
 * WebSocket-powered live price chart using lightweight-charts.
 * Connects to the backend WebSocket for real-time price ticks
 * and renders a smooth, auto-scrolling area/line chart.
 */

'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  ColorType,
  LineStyle,
  CrosshairMode,
} from 'lightweight-charts';
import { tokens } from '@/lib/colors';

// ============================================
// Types
// ============================================

interface StreamingChartProps {
  /** WebSocket URL for price data */
  wsUrl?: string;
  /** Symbol/coin ID to subscribe to */
  symbol: string;
  /** Chart height in pixels */
  height?: number;
  /** Chart type */
  type?: 'area' | 'line';
  /** Max data points to keep in memory */
  maxPoints?: number;
  /** Show price change stats */
  showStats?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Color override */
  color?: string;
}

interface PriceTick {
  price: number;
  timestamp: number;
}

// ============================================
// Connection Status Indicator
// ============================================

function ConnectionStatus({ status }: { status: 'connecting' | 'connected' | 'disconnected' | 'error' }) {
  const config = {
    connecting: { color: 'bg-yellow-500', label: 'Connecting...' },
    connected: { color: 'bg-gain', label: 'Live' },
    disconnected: { color: 'bg-text-disabled', label: 'Disconnected' },
    error: { color: 'bg-loss', label: 'Error' },
  };

  const { color, label } = config[status];

  return (
    <div className="flex items-center gap-1.5 text-xs text-text-muted">
      <span className={`w-1.5 h-1.5 rounded-full ${color} ${status === 'connected' ? 'animate-pulse' : ''}`} />
      {label}
    </div>
  );
}

// ============================================
// Component
// ============================================

export function StreamingChart({
  wsUrl,
  symbol,
  height = 300,
  type = 'area',
  maxPoints = 500,
  showStats = true,
  className = '',
  color,
}: StreamingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | ISeriesApi<'Line'> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const dataRef = useRef<PriceTick[]>([]);

  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [startPrice, setStartPrice] = useState<number | null>(null);

  const resolvedWsUrl = useMemo(() => {
    if (wsUrl) return wsUrl;
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:8080';
    return `${protocol}://${host}/ws/prices`;
  }, [wsUrl]);

  const seriesColor = useMemo(() => {
    if (color) return color;
    if (startPrice !== null && currentPrice !== null) {
      return currentPrice >= startPrice ? tokens.semantic.gain : tokens.semantic.loss;
    }
    return tokens.brand.primary;
  }, [color, startPrice, currentPrice]);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: tokens.text.muted,
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: tokens.surface.border, style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: tokens.text.disabled,
          style: LineStyle.Dashed,
          labelBackgroundColor: tokens.surface.default,
        },
        horzLine: {
          color: tokens.text.disabled,
          style: LineStyle.Dashed,
          labelBackgroundColor: tokens.surface.default,
        },
      },
      rightPriceScale: {
        borderColor: tokens.surface.border,
      },
      timeScale: {
        borderColor: tokens.surface.border,
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 10,
        fixLeftEdge: false,
        fixRightEdge: true,
      },
    });

    chartRef.current = chart;

    // Resize observer
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && chartRef.current) {
        chartRef.current.applyOptions({ width: entry.contentRect.width });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height]);

  // Create/update series when color changes
  useEffect(() => {
    if (!chartRef.current) return;

    // Remove old series
    if (seriesRef.current) {
      chartRef.current.removeSeries(seriesRef.current);
    }

    if (type === 'area') {
      const series = chartRef.current.addAreaSeries({
        lineColor: seriesColor,
        topColor: `${seriesColor}40`,
        bottomColor: `${seriesColor}05`,
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        priceFormat: {
          type: 'custom',
          formatter: (price: number) => {
            if (price >= 10000) return price.toFixed(0);
            if (price >= 1) return price.toFixed(2);
            return price.toFixed(6);
          },
        },
      });
      seriesRef.current = series;
    } else {
      const series = chartRef.current.addLineSeries({
        color: seriesColor,
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      });
      seriesRef.current = series;
    }

    // Re-apply existing data
    if (dataRef.current.length > 0) {
      const chartData = dataRef.current.map((d) => ({
        time: Math.floor(d.timestamp / 1000) as Time,
        value: d.price,
      }));
      seriesRef.current.setData(chartData);
    }
  }, [type, seriesColor]);

  // WebSocket connection
  useEffect(() => {
    setConnectionStatus('connecting');
    dataRef.current = [];

    const connect = () => {
      const ws = new WebSocket(resolvedWsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        // Subscribe to the symbol
        ws.send(JSON.stringify({ type: 'subscribe', symbols: [symbol] }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          // Handle different message formats from the backend
          let price: number | null = null;
          let timestamp = Date.now();

          if (msg.type === 'price' && msg.data) {
            // Format: { type: 'price', data: { symbol, price, timestamp } }
            if (msg.data.symbol?.toLowerCase() === symbol.toLowerCase() || 
                msg.data.id?.toLowerCase() === symbol.toLowerCase()) {
              price = msg.data.price ?? msg.data.current_price;
              timestamp = msg.data.timestamp ?? Date.now();
            }
          } else if (msg.prices && Array.isArray(msg.prices)) {
            // Format: { prices: [{ id, current_price, ... }] }
            const match = msg.prices.find(
              (p: Record<string, unknown>) =>
                (p.id as string)?.toLowerCase() === symbol.toLowerCase() ||
                (p.symbol as string)?.toLowerCase() === symbol.toLowerCase()
            );
            if (match) {
              price = (match.current_price ?? match.price) as number;
            }
          } else if (typeof msg.price === 'number') {
            price = msg.price;
            timestamp = msg.timestamp ?? Date.now();
          }

          if (price === null || isNaN(price)) return;

          const tick: PriceTick = { price, timestamp };

          // Track start price
          if (dataRef.current.length === 0) {
            setStartPrice(price);
          }
          setCurrentPrice(price);

          // Add to data buffer
          dataRef.current.push(tick);
          if (dataRef.current.length > maxPoints) {
            dataRef.current = dataRef.current.slice(-maxPoints);
          }

          // Update chart
          if (seriesRef.current) {
            seriesRef.current.update({
              time: Math.floor(timestamp / 1000) as Time,
              value: price,
            });
          }
        } catch {
          // Silently ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        // Reconnect after 3 seconds
        setTimeout(() => {
          if (wsRef.current === ws) {
            connect();
          }
        }, 3000);
      };

      ws.onerror = () => {
        setConnectionStatus('error');
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [resolvedWsUrl, symbol, maxPoints]);

  // Calculate change stats
  const changeStats = useMemo(() => {
    if (startPrice === null || currentPrice === null) return null;
    const change = currentPrice - startPrice;
    const changePercent = (change / startPrice) * 100;
    return {
      change,
      changePercent,
      isPositive: change >= 0,
    };
  }, [startPrice, currentPrice]);

  const formatPrice = useCallback((price: number) => {
    if (price >= 10000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(6)}`;
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* Header */}
      {showStats && (
        <div className="flex items-center justify-between px-1 mb-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-text-primary uppercase">{symbol}</span>
            {currentPrice !== null && (
              <span className="text-lg font-bold text-text-primary font-mono">
                {formatPrice(currentPrice)}
              </span>
            )}
            {changeStats && (
              <span className={`text-sm font-medium ${changeStats.isPositive ? 'text-gain' : 'text-loss'}`}>
                {changeStats.isPositive ? '+' : ''}{changeStats.changePercent.toFixed(2)}%
              </span>
            )}
          </div>
          <ConnectionStatus status={connectionStatus} />
        </div>
      )}

      {/* Chart */}
      <div ref={containerRef} style={{ height }} />

      {/* Reconnecting overlay */}
      {connectionStatus === 'disconnected' && (
        <div className="absolute inset-0 flex items-center justify-center bg-background-primary/50 backdrop-blur-sm rounded-xl">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-text-muted">Reconnecting...</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default StreamingChart;
