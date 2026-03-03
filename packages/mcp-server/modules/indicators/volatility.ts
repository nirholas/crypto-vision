/**
 * Volatility Indicators Module
 * 
 * @author nich
 * @website https://x.com/nichxbt
 * @github https://github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  accelerationBands,
  averageTrueRange,
  bollingerBands,
  bollingerBandsWidth,
  chandelierExit,
  donchianChannel,
  keltnerChannel,
  movingStandardDeviation,
  projectionOscillator,
  trueRange,
  ulcerIndex,
} from "indicatorts";
import { fetchOhlcvData } from "./utils/fetchOhlcv.js";

const symbolSchema = z.string().describe("Trading pair, e.g., 'BTC/USDT'");
const timeframeSchema = z.string().default("1h").describe("Timeframe, e.g., '1m', '1h', '1d'");
const limitSchema = z.number().default(100).describe("Number of OHLCV data points to fetch");
const periodSchema = (defaultVal: number) => z.number().default(defaultVal).describe("Period length");

export function registerVolatilityIndicators(server: McpServer): void {
  server.tool(
    "indicator_acceleration_bands",
    "Calculate the Acceleration Bands (AB) - shows potential breakout zones based on volatility",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(20),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = accelerationBands(asset.highs, asset.lows, asset.closings, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_atr",
    "Calculate the Average True Range (ATR) - measures market volatility by averaging the true range",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = averageTrueRange(asset.highs, asset.lows, asset.closings, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_bollinger_bands",
    "Calculate the Bollinger Bands (BB) - shows price volatility with upper/lower bands around an SMA",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(20),
      stdDev: z.number().default(2).describe("Standard deviation multiplier"),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, stdDev, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = bollingerBands(asset.closings, { period, stdDev });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_bbw",
    "Calculate the Bollinger Bands Width (BBW) - measures the distance between upper and lower Bollinger Bands",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(20),
      stdDev: z.number().default(2).describe("Standard deviation multiplier"),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, stdDev, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = bollingerBandsWidth(asset.closings, { period, stdDev });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_chandelier_exit",
    "Calculate the Chandelier Exit (CE) - trailing stop-loss based on ATR for trend following",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(22),
      multiplier: z.number().default(3).describe("ATR multiplier"),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, multiplier, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = chandelierExit(asset.highs, asset.lows, asset.closings, { period, multiplier });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_donchian_channel",
    "Calculate the Donchian Channel (DC) - shows highest high and lowest low over a period",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(20),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = donchianChannel(asset.highs, asset.lows, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_keltner_channel",
    "Calculate the Keltner Channel (KC) - volatility bands around an EMA using ATR",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(20),
      multiplier: z.number().default(2).describe("ATR multiplier"),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, multiplier, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = keltnerChannel(asset.highs, asset.lows, asset.closings, { period, multiplier });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_mstd",
    "Calculate the Moving Standard Deviation (MSTD) - measures price volatility over a rolling period",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(20),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = movingStandardDeviation(asset.closings, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_projection_oscillator",
    "Calculate the Projection Oscillator (PO) - shows where price is within a projected trading range",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = projectionOscillator(asset.highs, asset.lows, asset.closings, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_true_range",
    "Calculate the True Range (TR) - measures the greatest of current high-low, high-previous close, or low-previous close",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      limit: limitSchema,
    },
    async ({ symbol, timeframe, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = trueRange(asset.highs, asset.lows, asset.closings);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_ulcer_index",
    "Calculate the Ulcer Index (UI) - measures downside risk and volatility",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = ulcerIndex(asset.closings, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );
}
