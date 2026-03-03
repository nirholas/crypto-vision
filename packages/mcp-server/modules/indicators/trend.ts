/**
 * Trend Indicators Module
 * 
 * @author nich
 * @website https://x.com/nichxbt
 * @github https://github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  absolutePriceOscillator,
  aroon,
  balanceOfPower,
  chandeForecastOscillator,
  commodityChannelIndex,
  doubleExponentialMovingAverage,
  exponentialMovingAverage,
  massIndex,
  movingAverageConvergenceDivergence,
  movingMax,
  movingMin,
  movingSum,
  parabolicSar,
  qstick,
  kdj,
  rollingMovingAverage,
  simpleMovingAverage,
  sinceChange,
  tripleExponentialMovingAverage,
  triangularMovingAverage,
  tripleExponentialAverage,
  typicalPrice,
  volumeWeightedMovingAverage,
  vortex,
} from "indicatorts";
import { fetchOhlcvData } from "./utils/fetchOhlcv.js";

const symbolSchema = z.string().describe("Trading pair, e.g., 'BTC/USDT'");
const timeframeSchema = z.string().default("1h").describe("Timeframe, e.g., '1m', '1h', '1d'");
const limitSchema = z.number().default(100).describe("Number of OHLCV data points to fetch");
const periodSchema = (defaultVal: number) => z.number().default(defaultVal).describe("Period length");

export function registerTrendIndicators(server: McpServer): void {
  server.tool(
    "indicator_apo",
    "Calculate the Absolute Price Oscillator (APO) - measures difference between two EMAs to identify trend strength",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      fastPeriod: z.number().default(12).describe("Fast period for APO"),
      slowPeriod: z.number().default(26).describe("Slow period for APO"),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, fastPeriod, slowPeriod, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = absolutePriceOscillator(asset.closings, { fastPeriod, slowPeriod });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_aroon",
    "Calculate the Aroon Indicator - identifies trend changes and strength using high/low price extremes",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = aroon(asset.highs, asset.lows, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_bop",
    "Calculate the Balance of Power (BOP) - gauges buying vs. selling pressure based on price movement",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      limit: limitSchema,
    },
    async ({ symbol, timeframe, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = balanceOfPower(asset.openings, asset.highs, asset.lows, asset.closings);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_cfo",
    "Calculate the Chande Forecast Oscillator (CFO) - predicts future price movements relative to past trends",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = chandeForecastOscillator(asset.closings, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_cci",
    "Calculate the Commodity Channel Index (CCI) - detects overbought/oversold conditions and trend reversals",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(20),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = commodityChannelIndex(asset.highs, asset.lows, asset.closings, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_dema",
    "Calculate the Double Exponential Moving Average (DEMA) - smooths price data with reduced lag for trend detection",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(10),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = doubleExponentialMovingAverage(asset.closings, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_ema",
    "Calculate the Exponential Moving Average (EMA) - weights recent prices more heavily for trend analysis",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(10),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = exponentialMovingAverage(asset.closings, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_mass_index",
    "Calculate the Mass Index (MI) - identifies potential reversals by measuring range expansion",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(25),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = massIndex(asset.highs, asset.lows, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_macd",
    "Calculate the MACD - tracks momentum and trend direction via EMA differences",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      fastPeriod: z.number().default(12).describe("Fast period for MACD"),
      slowPeriod: z.number().default(26).describe("Slow period for MACD"),
      signalPeriod: z.number().default(9).describe("Signal period for MACD"),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, fastPeriod, slowPeriod, signalPeriod, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = movingAverageConvergenceDivergence(asset.closings, { fastPeriod, slowPeriod, signalPeriod });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_mmax",
    "Calculate the Moving Max (MMAX) - computes the maximum price over a rolling period",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(10),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = movingMax(asset.closings, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_mmin",
    "Calculate the Moving Min (MMIN) - computes the minimum price over a rolling period",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(10),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = movingMin(asset.closings, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_msum",
    "Calculate the Moving Sum (MSUM) - calculates the sum of prices over a rolling period",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(10),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = movingSum(asset.closings, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_psar",
    "Calculate the Parabolic SAR (PSAR) - provides stop-and-reverse points for trend following",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      accelerationFactorStep: z.number().default(0.02).describe("Acceleration factor step"),
      accelerationFactorMax: z.number().default(0.2).describe("Maximum acceleration factor"),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, accelerationFactorStep, accelerationFactorMax, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = parabolicSar(asset.highs, asset.lows, { accelerationFactorStep, accelerationFactorMax });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_qstick",
    "Calculate the Qstick Indicator - measures buying/selling pressure based on open-close differences",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = qstick(asset.openings, asset.closings, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_kdj",
    "Calculate the KDJ Indicator - combines stochastic and momentum signals for trend analysis",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(9),
      signalPeriod: z.number().default(3).describe("Signal period for KDJ"),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, signalPeriod, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = kdj(asset.highs, asset.lows, asset.closings, { period, signalPeriod });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_rma",
    "Calculate the Rolling Moving Average (RMA) - applies a rolling EMA for smoother trend tracking",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(10),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = rollingMovingAverage(asset.closings, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_sma",
    "Calculate the Simple Moving Average (SMA) - averages prices over a period to identify trends",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(10),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = simpleMovingAverage(asset.closings, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_since_change",
    "Calculate the Since Change - tracks the time since the last significant price change",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      limit: limitSchema,
    },
    async ({ symbol, timeframe, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = sinceChange(asset.closings);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_tema",
    "Calculate the Triple Exponential Moving Average (TEMA) - reduces lag further than DEMA for trend clarity",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(10),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = tripleExponentialMovingAverage(asset.closings, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_trima",
    "Calculate the Triangular Moving Average (TRIMA) - weights middle prices more for smoother trends",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(10),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = triangularMovingAverage(asset.closings, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_trix",
    "Calculate the Triple Exponential Average (TRIX) - measures momentum with triple smoothing",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(15),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = tripleExponentialAverage(asset.closings, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_typical_price",
    "Calculate the Typical Price - averages high, low, and close prices for a balanced trend view",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      limit: limitSchema,
    },
    async ({ symbol, timeframe, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = typicalPrice(asset.highs, asset.lows, asset.closings);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_vwma",
    "Calculate the Volume Weighted Moving Average (VWMA) - incorporates volume into moving averages for trend strength",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = volumeWeightedMovingAverage(asset.closings, asset.volumes, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_vortex",
    "Calculate the Vortex Indicator - identifies trend direction and strength using true range",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = vortex(asset.highs, asset.lows, asset.closings, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );
}
