/**
 * Chart Components Index
 * 
 * Barrel export for all chart components.
 */

// TradingView-style candlestick chart
export { CandlestickChart, default as CandlestickChartDefault } from './CandlestickChart';
export type { OHLCVCandle } from './CandlestickChart';

// Real-time WebSocket streaming chart
export { StreamingChart, default as StreamingChartDefault } from './StreamingChart';

// Advanced analytics charts
export {
  DrawdownChart,
  SharpeChart,
  RegimeChart,
  CorrelationHeatmap,
  RiskRadar,
  YieldChart,
  REGIME_COLORS,
} from './AnalyticsCharts';
