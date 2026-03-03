/**
 * Momentum Indicators Module
 * 
 * @author nich
 * @website https://x.com/nichxbt
 * @github https://github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  awesomeOscillator,
  chaikinOscillator,
  ichimokuCloud,
  percentagePriceOscillator,
  percentageVolumeOscillator,
  priceRateOfChange,
  relativeStrengthIndex,
  stochasticOscillator,
  williamsR,
} from "indicatorts";
import { fetchOhlcvData } from "./utils/fetchOhlcv.js";

const symbolSchema = z.string().describe("Trading pair, e.g., 'BTC/USDT'");
const timeframeSchema = z.string().default("1h").describe("Timeframe, e.g., '1m', '1h', '1d'");
const limitSchema = z.number().default(100).describe("Number of OHLCV data points to fetch");
const periodSchema = (defaultVal: number) => z.number().default(defaultVal).describe("Period length");

export function registerMomentumIndicators(server: McpServer): void {
  server.tool(
    "indicator_ao",
    "Calculate the Awesome Oscillator (AO) - measures market momentum using SMA differences",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      fastPeriod: z.number().default(5).describe("Fast period for AO"),
      slowPeriod: z.number().default(34).describe("Slow period for AO"),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, fastPeriod, slowPeriod, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = awesomeOscillator(asset.highs, asset.lows, { fastPeriod, slowPeriod });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_chaikin_oscillator",
    "Calculate the Chaikin Oscillator (CMO) - measures accumulation/distribution momentum",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      fastPeriod: z.number().default(3).describe("Fast period for CMO"),
      slowPeriod: z.number().default(10).describe("Slow period for CMO"),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, fastPeriod, slowPeriod, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = chaikinOscillator(asset.highs, asset.lows, asset.closings, asset.volumes, { fastPeriod, slowPeriod });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_ichimoku",
    "Calculate the Ichimoku Cloud - comprehensive indicator showing support, resistance, trend direction and momentum",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      conversionPeriod: z.number().default(9).describe("Conversion line period"),
      basePeriod: z.number().default(26).describe("Base line period"),
      spanPeriod: z.number().default(52).describe("Leading span period"),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, conversionPeriod, basePeriod, spanPeriod, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = ichimokuCloud(asset.highs, asset.lows, asset.closings, { conversionPeriod, basePeriod, spanPeriod });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_ppo",
    "Calculate the Percentage Price Oscillator (PPO) - shows the relationship between two EMAs as a percentage",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      fastPeriod: z.number().default(12).describe("Fast period for PPO"),
      slowPeriod: z.number().default(26).describe("Slow period for PPO"),
      signalPeriod: z.number().default(9).describe("Signal period for PPO"),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, fastPeriod, slowPeriod, signalPeriod, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = percentagePriceOscillator(asset.closings, { fastPeriod, slowPeriod, signalPeriod });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_pvo",
    "Calculate the Percentage Volume Oscillator (PVO) - measures volume momentum as percentage difference between EMAs",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      fastPeriod: z.number().default(12).describe("Fast period for PVO"),
      slowPeriod: z.number().default(26).describe("Slow period for PVO"),
      signalPeriod: z.number().default(9).describe("Signal period for PVO"),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, fastPeriod, slowPeriod, signalPeriod, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = percentageVolumeOscillator(asset.volumes, { fastPeriod, slowPeriod, signalPeriod });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_roc",
    "Calculate the Price Rate of Change (ROC) - measures percentage change over a period",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = priceRateOfChange(asset.closings, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_rsi",
    "Calculate the Relative Strength Index (RSI) - measures speed and magnitude of price changes to identify overbought/oversold conditions",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = relativeStrengthIndex(asset.closings, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_stochastic",
    "Calculate the Stochastic Oscillator (STOCH) - compares closing price to price range over a period",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      signalPeriod: z.number().default(3).describe("Signal period for STOCH"),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, signalPeriod, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = stochasticOscillator(asset.highs, asset.lows, asset.closings, { period, signalPeriod });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_williams_r",
    "Calculate the Williams %R (WILLR) - momentum indicator measuring overbought/oversold levels",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = williamsR(asset.highs, asset.lows, asset.closings, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );
}
