/**
 * Trend Trading Strategies Module
 * 
 * @author nich
 * @website https://x.com/nichxbt
 * @github https://github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  absolutePriceOscillatorStrategy,
  aroonStrategy,
  balanceOfPowerStrategy,
  chandeForecastOscillatorStrategy,
  kdjStrategy,
  macdStrategy,
  parabolicSarStrategy,
  typicalPriceStrategy,
  volumeWeightedMovingAverageStrategy,
  vortexStrategy,
} from "indicatorts";
import { fetchOhlcvData } from "../utils/fetchOhlcv.js";

const symbolSchema = z.string().describe("Trading pair, e.g., 'BTC/USDT'");
const timeframeSchema = z.string().default("1h").describe("Timeframe, e.g., '1m', '1h', '1d'");
const limitSchema = z.number().default(100).describe("Number of OHLCV data points to fetch");
const periodSchema = (defaultVal: number) => z.number().default(defaultVal).describe("Period length");

export function registerTrendStrategies(server: McpServer): void {
  server.tool(
    "strategy_apo",
    "APO Strategy - trading signals based on Absolute Price Oscillator. Returns: -1 (SELL), 0 (HOLD), 1 (BUY)",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      fastPeriod: z.number().default(12).describe("Fast period"),
      slowPeriod: z.number().default(26).describe("Slow period"),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, fastPeriod, slowPeriod, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = absolutePriceOscillatorStrategy(asset, { fast: fastPeriod, slow: slowPeriod });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "strategy_aroon",
    "Aroon Strategy - trading signals based on trend changes and strength. Returns: -1 (SELL), 0 (HOLD), 1 (BUY)",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = aroonStrategy(asset, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "strategy_bop",
    "Balance of Power Strategy - trading signals based on buying/selling pressure. Returns: -1 (SELL), 0 (HOLD), 1 (BUY)",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = balanceOfPowerStrategy(asset, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "strategy_cfo",
    "Chande Forecast Oscillator Strategy - trading signals based on price predictions. Returns: -1 (SELL), 0 (HOLD), 1 (BUY)",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = chandeForecastOscillatorStrategy(asset, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "strategy_kdj",
    "KDJ Strategy - trading signals combining stochastic and momentum. Returns: -1 (SELL), 0 (HOLD), 1 (BUY)",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(9),
      signalPeriod: z.number().default(3).describe("Signal period"),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, signalPeriod, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = kdjStrategy(asset, { period, signal: signalPeriod });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "strategy_macd",
    "MACD Strategy - trading signals based on moving average convergence/divergence. Returns: -1 (SELL), 0 (HOLD), 1 (BUY)",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      fastPeriod: z.number().default(12).describe("Fast period"),
      slowPeriod: z.number().default(26).describe("Slow period"),
      signalPeriod: z.number().default(9).describe("Signal period"),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, fastPeriod, slowPeriod, signalPeriod, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = macdStrategy(asset, { fast: fastPeriod, slow: slowPeriod, signal: signalPeriod });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "strategy_psar",
    "Parabolic SAR Strategy - trading signals based on trend reversal points. Returns: -1 (SELL), 0 (HOLD), 1 (BUY)",
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
        const result = parabolicSarStrategy(asset, { accelerationFactorStep, accelerationFactorMax });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "strategy_typical_price",
    "Typical Price Strategy - trading signals based on average of high, low, close. Returns: -1 (SELL), 0 (HOLD), 1 (BUY)",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = typicalPriceStrategy(asset, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "strategy_vwma",
    "VWMA Strategy - trading signals based on volume-weighted moving average. Returns: -1 (SELL), 0 (HOLD), 1 (BUY)",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = volumeWeightedMovingAverageStrategy(asset, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "strategy_vortex",
    "Vortex Strategy - trading signals based on trend direction and strength. Returns: -1 (SELL), 0 (HOLD), 1 (BUY)",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = vortexStrategy(asset, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );
}
