/**
 * Crypto Vision — Anomaly Processors
 *
 * Hooks into existing data flows to feed the anomaly engine.
 * Registers WebSocket broadcasting and BigQuery logging handlers.
 *
 * Import this module once at startup to wire everything up.
 */

import { anomalyEngine, type AnomalyEvent } from "./anomaly.js";
import { broadcastToTopic } from "./ws.js";
import { insertRows } from "./bigquery.js";
import { log } from "./logger.js";

// ─── WebSocket Broadcasting ──────────────────────────────────

anomalyEngine.onAnomaly((event: AnomalyEvent) => {
  broadcastToTopic(
    "alerts",
    JSON.stringify({
      type: "anomaly",
      data: event,
      timestamp: event.detectedAt,
    }),
  );
});

// ─── BigQuery Logging ────────────────────────────────────────

anomalyEngine.onAnomaly((event: AnomalyEvent) => {
  insertRows("anomaly_events", [
    {
      event_id: event.id,
      type: event.type,
      severity: event.severity,
      asset: event.asset,
      metric: event.metric,
      current_value: event.currentValue,
      expected_low: event.expectedRange.low,
      expected_high: event.expectedRange.high,
      deviation: event.deviation,
      message: event.message,
      context: JSON.stringify(event.context),
      detected_at: event.detectedAt,
      detector: event.detector,
    },
  ]).catch((err: unknown) => {
    log.debug({ err }, "Failed to log anomaly to BigQuery (non-fatal)");
  });
});

// ─── Data Feed Processors ────────────────────────────────────

/**
 * Process price updates from CoinGecko/CoinCap.
 * Checks for both upward spikes and downward crashes,
 * plus volume anomalies if volume data is provided.
 */
export function processPrice(
  coinId: string,
  price: number,
  volume24h?: number,
): void {
  // Price change detection (both directions)
  anomalyEngine.ingest("price_spike", coinId, "price_usd", price);
  anomalyEngine.ingest("price_crash", coinId, "price_usd", price);

  // Volume anomaly detection
  if (volume24h !== undefined && volume24h > 0) {
    anomalyEngine.ingest("volume_surge", coinId, "volume_24h", volume24h);
    anomalyEngine.ingest("volume_drop", coinId, "volume_24h", volume24h);
  }
}

/**
 * Process DeFi protocol TVL updates from DeFiLlama.
 * Monitors for sudden TVL drain (rug pulls, exploits) and surges.
 */
export function processTVL(
  protocol: string,
  tvl: number,
  chain?: string,
): void {
  const asset = chain ? `${protocol}:${chain}` : protocol;
  anomalyEngine.ingest("tvl_drain", asset, "tvl_usd", tvl);
  anomalyEngine.ingest("tvl_surge", asset, "tvl_usd", tvl);
}

/**
 * Process stablecoin prices.
 * Stablecoins should trade at ~$1.00 — any material deviation is flagged.
 */
export function processStablecoinPrice(
  symbol: string,
  price: number,
): void {
  // Only feed non-trivial price deviations (>0.1% from peg)
  const deviation = Math.abs(price - 1.0);
  if (deviation > 0.001) {
    anomalyEngine.ingest("stablecoin_depeg", symbol, "price_usd", price, {
      pegDeviation: deviation,
      pegDeviationPct: `${(deviation * 100).toFixed(3)}%`,
    });
  }
}

/**
 * Process gas prices for EVM chains.
 */
export function processGas(chain: string, gasPriceGwei: number): void {
  anomalyEngine.ingest("gas_spike", chain, "gas_gwei", gasPriceGwei);
}

/**
 * Process derivatives data — funding rates and open interest.
 */
export function processDerivatives(
  symbol: string,
  fundingRate: number,
  openInterest: number,
): void {
  anomalyEngine.ingest(
    "funding_rate_extreme",
    symbol,
    "funding_rate",
    fundingRate,
  );
  anomalyEngine.ingest(
    "open_interest_surge",
    symbol,
    "open_interest",
    openInterest,
  );
}

/**
 * Process exchange flow data — large inflows may signal sell pressure,
 * large outflows may signal accumulation.
 */
export function processExchangeFlow(
  token: string,
  exchange: string,
  amount: number,
  direction: "inflow" | "outflow",
): void {
  const type =
    direction === "inflow" ? "exchange_inflow" : "exchange_outflow";
  anomalyEngine.ingest(
    type,
    `${token}:${exchange}`,
    `${direction}_usd`,
    amount,
    {
      exchange,
      token,
      direction,
    },
  );
}

/**
 * Process whale movements — large transfers between wallets.
 */
export function processWhaleMovement(
  token: string,
  amount: number,
  context: Record<string, unknown> = {},
): void {
  anomalyEngine.ingest("whale_movement", token, "transfer_usd", amount, context);
}

/**
 * Process volatility data — realized or implied volatility changes.
 */
export function processVolatility(
  asset: string,
  volatility: number,
): void {
  anomalyEngine.ingest("volatility_spike", asset, "volatility", volatility);
}
