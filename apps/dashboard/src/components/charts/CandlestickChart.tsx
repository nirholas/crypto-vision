/**
 * TradingView-style Candlestick Chart
 * 
 * Uses lightweight-charts for professional OHLCV visualization
 * with real-time WebSocket support, drawing tools, and crosshair.
 */

'use client';

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type Time,
  ColorType,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts';
import { tokens } from '@/lib/colors';

// ============================================
// Types
// ============================================

export interface OHLCVCandle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface CandlestickChartProps {
  data: OHLCVCandle[];
  height?: number;
  className?: string;
  showVolume?: boolean;
  showCrosshair?: boolean;
  autoResize?: boolean;
  watermarkText?: string;
  onCrosshairMove?: (price: number | null, time: number | null) => void;
}

// ============================================
// Price Formatting
// ============================================

function formatPriceForAxis(price: number): string {
  if (price >= 10000) return price.toFixed(0);
  if (price >= 100) return price.toFixed(1);
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}

// ============================================
// Component
// ============================================

export function CandlestickChart({
  data,
  height = 400,
  className = '',
  showVolume = true,
  showCrosshair = true,
  autoResize = true,
  watermarkText,
  onCrosshairMove,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [legendData, setLegendData] = useState<{
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
    time: number;
  } | null>(null);

  // Memoize chart data transformation
  const { candleData, volumeData } = useMemo(() => {
    const sorted = [...data].sort((a, b) => a.time - b.time);
    
    const candles: CandlestickData[] = sorted.map((d) => ({
      time: d.time as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumes: HistogramData[] = sorted.map((d) => ({
      time: d.time as Time,
      value: d.volume ?? 0,
      color: d.close >= d.open
        ? 'rgba(22, 199, 132, 0.35)' // gain with transparency
        : 'rgba(234, 57, 67, 0.35)', // loss with transparency
    }));

    return { candleData: candles, volumeData: volumes };
  }, [data]);

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
        vertLines: { color: tokens.surface.border, style: LineStyle.Dotted },
        horzLines: { color: tokens.surface.border, style: LineStyle.Dotted },
      },
      crosshair: {
        mode: showCrosshair ? CrosshairMode.Normal : CrosshairMode.Hidden,
        vertLine: {
          color: tokens.text.disabled,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: tokens.surface.default,
        },
        horzLine: {
          color: tokens.text.disabled,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: tokens.surface.default,
        },
      },
      rightPriceScale: {
        borderColor: tokens.surface.border,
        scaleMargins: {
          top: 0.1,
          bottom: showVolume ? 0.25 : 0.05,
        },
      },
      timeScale: {
        borderColor: tokens.surface.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 8,
        minBarSpacing: 3,
      },
      handleScale: {
        axisPressedMouseMove: true,
      },
      handleScroll: {
        vertTouchDrag: false,
      },
    });

    if (watermarkText) {
      chart.applyOptions({
        watermark: {
          visible: true,
          text: watermarkText,
          fontSize: 48,
          color: 'rgba(128, 138, 157, 0.08)',
          horzAlign: 'center',
          vertAlign: 'center',
        },
      });
    }

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: tokens.semantic.gain,
      downColor: tokens.semantic.loss,
      borderUpColor: tokens.semantic.gain,
      borderDownColor: tokens.semantic.loss,
      wickUpColor: tokens.semantic.gain,
      wickDownColor: tokens.semantic.loss,
      priceFormat: {
        type: 'custom',
        formatter: formatPriceForAxis,
      },
    });

    candleSeries.setData(candleData);
    candleSeriesRef.current = candleSeries;

    // Volume histogram (overlaid at bottom)
    if (showVolume) {
      const volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });

      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
        drawTicks: false,
      });

      volumeSeries.setData(volumeData);
      volumeSeriesRef.current = volumeSeries;
    }

    // Crosshair move handler
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setLegendData(null);
        onCrosshairMove?.(null, null);
        return;
      }

      const candle = param.seriesData.get(candleSeries) as CandlestickData | undefined;
      const vol = showVolume
        ? (param.seriesData.get(volumeSeries!) as HistogramData | undefined)
        : undefined;

      if (candle) {
        setLegendData({
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: vol?.value,
          time: param.time as number,
        });
        onCrosshairMove?.(candle.close, param.time as number);
      }
    });

    // Fit content initially
    chart.timeScale().fitContent();

    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, showVolume, showCrosshair, watermarkText]);

  // Update data when it changes (without recreating chart)
  useEffect(() => {
    if (candleSeriesRef.current && candleData.length > 0) {
      candleSeriesRef.current.setData(candleData);
    }
    if (volumeSeriesRef.current && volumeData.length > 0) {
      volumeSeriesRef.current.setData(volumeData);
    }
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [candleData, volumeData]);

  // Auto-resize
  useEffect(() => {
    if (!autoResize || !containerRef.current || !chartRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && chartRef.current) {
        chartRef.current.applyOptions({
          width: entry.contentRect.width,
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [autoResize]);

  // Public method to add real-time candle
  const addCandle = useCallback((candle: OHLCVCandle) => {
    if (!candleSeriesRef.current) return;
    candleSeriesRef.current.update({
      time: candle.time as Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    });
    if (volumeSeriesRef.current && candle.volume !== undefined) {
      volumeSeriesRef.current.update({
        time: candle.time as Time,
        value: candle.volume,
        color: candle.close >= candle.open
          ? 'rgba(22, 199, 132, 0.35)'
          : 'rgba(234, 57, 67, 0.35)',
      });
    }
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* OHLCV Legend overlay */}
      {legendData && (
        <div className="absolute top-2 left-3 z-10 flex items-center gap-3 text-xs font-mono pointer-events-none">
          <span className="text-text-muted">
            O <span className={legendData.close >= legendData.open ? 'text-gain' : 'text-loss'}>
              {formatPriceForAxis(legendData.open)}
            </span>
          </span>
          <span className="text-text-muted">
            H <span className="text-text-primary">{formatPriceForAxis(legendData.high)}</span>
          </span>
          <span className="text-text-muted">
            L <span className="text-text-primary">{formatPriceForAxis(legendData.low)}</span>
          </span>
          <span className="text-text-muted">
            C <span className={legendData.close >= legendData.open ? 'text-gain' : 'text-loss'}>
              {formatPriceForAxis(legendData.close)}
            </span>
          </span>
          {legendData.volume !== undefined && (
            <span className="text-text-muted">
              V <span className="text-text-secondary">
                {legendData.volume >= 1e9
                  ? `${(legendData.volume / 1e9).toFixed(1)}B`
                  : legendData.volume >= 1e6
                    ? `${(legendData.volume / 1e6).toFixed(1)}M`
                    : legendData.volume >= 1e3
                      ? `${(legendData.volume / 1e3).toFixed(1)}K`
                      : legendData.volume.toFixed(0)}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Chart container */}
      <div ref={containerRef} style={{ height }} />
    </div>
  );
}

export default CandlestickChart;
