/**
 * Crypto Vision — Real-Time Anomaly Detection Engine
 *
 * Statistical anomaly detection using Modified Z-Score (robust to outliers)
 * with sliding time-series windows for each (type, asset, metric) triple.
 *
 * Features:
 * - Modified Z-Score via Median Absolute Deviation (MAD)
 * - Exponentially weighted moving average (EWMA) for trend detection
 * - Per-asset cooldowns to prevent alert fatigue
 * - Configurable thresholds per anomaly type
 * - Direction-aware detection (spikes vs crashes)
 * - Handler registry for WebSocket broadcast, BigQuery logging, etc.
 */

import { cache } from "./cache.js";
import { log } from "./logger.js";

// ─── Types ───────────────────────────────────────────────────

export interface AnomalyEvent {
  id: string;
  type: AnomalyType;
  severity: "info" | "warning" | "critical";
  asset: string;
  metric: string;
  currentValue: number;
  expectedRange: { low: number; high: number };
  deviation: number;       // Standard deviations from mean
  message: string;
  context: Record<string, unknown>;
  detectedAt: string;
  detector: string;
}

export type AnomalyType =
  | "price_spike"
  | "price_crash"
  | "volume_surge"
  | "volume_drop"
  | "tvl_drain"
  | "tvl_surge"
  | "gas_spike"
  | "whale_movement"
  | "stablecoin_depeg"
  | "liquidity_removal"
  | "funding_rate_extreme"
  | "open_interest_surge"
  | "exchange_outflow"
  | "exchange_inflow"
  | "correlation_break"
  | "volatility_spike";

// ─── Statistical Detectors ───────────────────────────────────

interface TimeSeriesWindow {
  values: number[];
  timestamps: number[];
  maxSize: number;
}

class SlidingWindow implements TimeSeriesWindow {
  values: number[] = [];
  timestamps: number[] = [];
  maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  add(value: number, timestamp = Date.now()): void {
    this.values.push(value);
    this.timestamps.push(timestamp);
    if (this.values.length > this.maxSize) {
      this.values.shift();
      this.timestamps.shift();
    }
  }

  get length(): number {
    return this.values.length;
  }

  get mean(): number {
    if (this.values.length === 0) return 0;
    return this.values.reduce((a, b) => a + b, 0) / this.values.length;
  }

  get std(): number {
    if (this.values.length < 2) return 0;
    const m = this.mean;
    const variance =
      this.values.reduce((sum, v) => sum + (v - m) ** 2, 0) /
      (this.values.length - 1);
    return Math.sqrt(variance);
  }

  get median(): number {
    if (this.values.length === 0) return 0;
    const sorted = [...this.values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Modified Z-Score — robust to outliers using MAD (Median Absolute Deviation).
   *
   * The constant 0.6745 is the 0.75th quantile of the standard normal distribution.
   * This makes the modified z-score comparable to the standard z-score for normally
   * distributed data.
   */
  modifiedZScore(value: number): number {
    if (this.values.length < 3) return 0;
    const med = this.median;
    const deviations = this.values.map((v) => Math.abs(v - med));
    const sortedDeviations = [...deviations].sort((a, b) => a - b);
    const madMid = Math.floor(sortedDeviations.length / 2);
    const mad =
      sortedDeviations.length % 2 !== 0
        ? sortedDeviations[madMid]
        : (sortedDeviations[madMid - 1] + sortedDeviations[madMid]) / 2;
    if (mad === 0) return 0;
    return (0.6745 * (value - med)) / mad;
  }

  /** Exponentially weighted moving average */
  ewma(alpha = 0.1): number {
    if (this.values.length === 0) return 0;
    let result = this.values[0];
    for (let i = 1; i < this.values.length; i++) {
      result = alpha * this.values[i] + (1 - alpha) * result;
    }
    return result;
  }

  /** Rate of change (percentage) over `periods` data points */
  rateOfChange(periods = 1): number {
    if (this.values.length < periods + 1) return 0;
    const current = this.values[this.values.length - 1];
    const previous = this.values[this.values.length - 1 - periods];
    return previous === 0 ? 0 : ((current - previous) / previous) * 100;
  }
}

// ─── Detector Registry ───────────────────────────────────────

interface DetectorConfig {
  name: string;
  zScoreThreshold: number;    // How many std devs = anomaly
  minDataPoints: number;      // Minimum window size before alerting
  cooldownMs: number;         // Min time between alerts for same asset+type
  severity: (deviation: number) => AnomalyEvent["severity"];
}

const DETECTOR_CONFIGS: Record<AnomalyType, DetectorConfig> = {
  price_spike: {
    name: "Price Spike",
    zScoreThreshold: 3.0,
    minDataPoints: 50,
    cooldownMs: 5 * 60_000,    // 5 min cooldown
    severity: (d) => (d > 5 ? "critical" : d > 3.5 ? "warning" : "info"),
  },
  price_crash: {
    name: "Price Crash",
    zScoreThreshold: -3.0,
    minDataPoints: 50,
    cooldownMs: 5 * 60_000,
    severity: (d) =>
      d < -5 ? "critical" : d < -3.5 ? "warning" : "info",
  },
  volume_surge: {
    name: "Volume Surge",
    zScoreThreshold: 3.5,
    minDataPoints: 30,
    cooldownMs: 15 * 60_000,
    severity: (d) => (d > 5 ? "critical" : d > 4 ? "warning" : "info"),
  },
  volume_drop: {
    name: "Volume Drop",
    zScoreThreshold: -3.0,
    minDataPoints: 30,
    cooldownMs: 30 * 60_000,
    severity: (d) => (Math.abs(d) > 4 ? "warning" : "info"),
  },
  tvl_drain: {
    name: "TVL Drain",
    zScoreThreshold: -2.5,
    minDataPoints: 20,
    cooldownMs: 30 * 60_000,
    severity: (d) =>
      Math.abs(d) > 4 ? "critical" : Math.abs(d) > 3 ? "warning" : "info",
  },
  tvl_surge: {
    name: "TVL Surge",
    zScoreThreshold: 3.0,
    minDataPoints: 20,
    cooldownMs: 30 * 60_000,
    severity: (d) => (d > 5 ? "warning" : "info"),
  },
  gas_spike: {
    name: "Gas Spike",
    zScoreThreshold: 3.0,
    minDataPoints: 30,
    cooldownMs: 10 * 60_000,
    severity: (d) => (d > 5 ? "critical" : d > 3.5 ? "warning" : "info"),
  },
  whale_movement: {
    name: "Whale Movement",
    zScoreThreshold: 3.0,
    minDataPoints: 10,
    cooldownMs: 5 * 60_000,
    severity: (d) => (d > 5 ? "critical" : d > 3.5 ? "warning" : "info"),
  },
  stablecoin_depeg: {
    name: "Stablecoin Depeg",
    zScoreThreshold: 2.0, // Lower threshold — depegs are always important
    minDataPoints: 10,
    cooldownMs: 1 * 60_000,
    severity: (d) =>
      Math.abs(d) > 3 ? "critical" : Math.abs(d) > 2 ? "warning" : "info",
  },
  liquidity_removal: {
    name: "Liquidity Removal",
    zScoreThreshold: -3.0,
    minDataPoints: 10,
    cooldownMs: 10 * 60_000,
    severity: (d) => (Math.abs(d) > 4 ? "critical" : "warning"),
  },
  funding_rate_extreme: {
    name: "Funding Rate Extreme",
    zScoreThreshold: 3.0,
    minDataPoints: 20,
    cooldownMs: 30 * 60_000,
    severity: (d) => (d > 5 ? "critical" : d > 3.5 ? "warning" : "info"),
  },
  open_interest_surge: {
    name: "OI Surge",
    zScoreThreshold: 3.0,
    minDataPoints: 20,
    cooldownMs: 15 * 60_000,
    severity: (d) => (d > 5 ? "critical" : "warning"),
  },
  exchange_outflow: {
    name: "Exchange Outflow",
    zScoreThreshold: 3.0,
    minDataPoints: 10,
    cooldownMs: 15 * 60_000,
    severity: (d) => (d > 4 ? "critical" : "warning"),
  },
  exchange_inflow: {
    name: "Exchange Inflow",
    zScoreThreshold: 3.0,
    minDataPoints: 10,
    cooldownMs: 15 * 60_000,
    severity: (d) => (d > 4 ? "critical" : "warning"),
  },
  correlation_break: {
    name: "Correlation Break",
    zScoreThreshold: 2.5,
    minDataPoints: 100,
    cooldownMs: 60 * 60_000,
    severity: () => "warning",
  },
  volatility_spike: {
    name: "Volatility Spike",
    zScoreThreshold: 3.0,
    minDataPoints: 30,
    cooldownMs: 15 * 60_000,
    severity: (d) => (d > 5 ? "critical" : d > 3.5 ? "warning" : "info"),
  },
};

// ─── Direction Sets (for directional filtering) ──────────────

/** Anomaly types that should only fire on negative z-scores */
const NEGATIVE_TYPES = new Set<AnomalyType>([
  "price_crash",
  "tvl_drain",
  "volume_drop",
  "liquidity_removal",
]);

/** Anomaly types that should only fire on positive z-scores */
const POSITIVE_TYPES = new Set<AnomalyType>([
  "price_spike",
  "volume_surge",
  "tvl_surge",
  "gas_spike",
  "whale_movement",
  "open_interest_surge",
  "exchange_outflow",
  "exchange_inflow",
  "volatility_spike",
]);

// ─── Anomaly Engine ──────────────────────────────────────────

export type AnomalyHandler = (event: AnomalyEvent) => void;

class AnomalyEngine {
  private windows = new Map<string, SlidingWindow>();
  private lastAlert = new Map<string, number>();
  private handlers: AnomalyHandler[] = [];
  private totalDetected = 0;

  /** Get or create sliding window for a metric */
  private getWindow(key: string, maxSize = 1000): SlidingWindow {
    let window = this.windows.get(key);
    if (!window) {
      window = new SlidingWindow(maxSize);
      this.windows.set(key, window);
    }
    return window;
  }

  /** Register an anomaly event handler (WebSocket broadcast, BigQuery insert, etc.) */
  onAnomaly(handler: AnomalyHandler): void {
    this.handlers.push(handler);
  }

  /** Remove a handler (used when SSE clients disconnect) */
  removeHandler(handler: AnomalyHandler): void {
    const idx = this.handlers.indexOf(handler);
    if (idx !== -1) this.handlers.splice(idx, 1);
  }

  /**
   * Feed a new data point and check for anomalies.
   *
   * Returns an AnomalyEvent if an anomaly was detected and dispatched,
   * or null if the value is within normal range.
   */
  ingest(
    type: AnomalyType,
    asset: string,
    metric: string,
    value: number,
    context: Record<string, unknown> = {},
  ): AnomalyEvent | null {
    const config = DETECTOR_CONFIGS[type];
    if (!config) return null;

    const windowKey = `${type}:${asset}:${metric}`;
    const window = this.getWindow(windowKey);
    window.add(value);

    // Need minimum data points for reliable detection
    if (window.length < config.minDataPoints) return null;

    // Calculate modified Z-score (robust to outliers)
    const zScore = window.modifiedZScore(value);
    const absZ = Math.abs(zScore);

    // Check threshold
    const threshold = Math.abs(config.zScoreThreshold);
    if (absZ < threshold) return null;

    // Directional filtering: crash/drain = negative only, spike/surge = positive only
    if (NEGATIVE_TYPES.has(type) && zScore > 0) return null;
    if (POSITIVE_TYPES.has(type) && zScore < 0) return null;

    // Cooldown check — prevent alert fatigue for same asset+type
    const alertKey = `${type}:${asset}`;
    const lastTime = this.lastAlert.get(alertKey) ?? 0;
    if (Date.now() - lastTime < config.cooldownMs) return null;

    // Build anomaly event
    const event: AnomalyEvent = {
      id: `${type}-${asset}-${Date.now()}`,
      type,
      severity: config.severity(zScore),
      asset,
      metric,
      currentValue: value,
      expectedRange: {
        low: window.mean - 2 * window.std,
        high: window.mean + 2 * window.std,
      },
      deviation: Math.round(zScore * 100) / 100,
      message: `${config.name}: ${asset} ${metric} = ${value.toFixed(4)} (${zScore > 0 ? "+" : ""}${zScore.toFixed(1)}σ from mean ${window.mean.toFixed(4)})`,
      context,
      detectedAt: new Date().toISOString(),
      detector: "statistical-mzs",
    };

    this.lastAlert.set(alertKey, Date.now());
    this.totalDetected++;

    // Dispatch to all registered handlers
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        log.error({ err }, "Anomaly handler error");
      }
    }

    log.warn({ anomaly: event }, "Anomaly detected");
    return event;
  }

  /** Get current engine statistics */
  stats(): {
    windows: number;
    totalDataPoints: number;
    totalDetected: number;
    activeAlertKeys: number;
  } {
    let totalDataPoints = 0;
    for (const w of this.windows.values()) totalDataPoints += w.length;
    return {
      windows: this.windows.size,
      totalDataPoints,
      totalDetected: this.totalDetected,
      activeAlertKeys: this.lastAlert.size,
    };
  }

  /** Persist sliding-window state to cache for crash recovery */
  async saveState(): Promise<void> {
    const state: Record<string, number[]> = {};
    for (const [key, window] of this.windows) {
      state[key] = [...window.values];
    }
    await cache.set("anomaly:engine:state", state, 86_400); // 24h
    log.debug({ metrics: Object.keys(state).length }, "Anomaly engine state saved");
  }

  /** Restore sliding-window state from cache on startup */
  async loadState(): Promise<void> {
    try {
      const state = await cache.get<Record<string, number[]>>("anomaly:engine:state");
      if (!state) return;

      let restored = 0;
      for (const [key, values] of Object.entries(state)) {
        const window = new SlidingWindow(1000);
        for (const v of values) window.add(v);
        this.windows.set(key, window);
        restored++;
      }
      log.info({ restoredMetrics: restored }, "Anomaly engine state restored from cache");
    } catch (err) {
      log.warn({ err }, "Failed to restore anomaly engine state — starting fresh");
    }
  }

  /** Reset all windows and cooldowns (useful for testing) */
  reset(): void {
    this.windows.clear();
    this.lastAlert.clear();
    this.handlers.length = 0;
    this.totalDetected = 0;
  }
}

/** Singleton anomaly engine instance */
export const anomalyEngine = new AnomalyEngine();

// Export internals for testing and route introspection
export { DETECTOR_CONFIGS, SlidingWindow };

