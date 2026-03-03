/**
 * Momentum Trading Strategies Module
 * 
 * @author nich
 * @website https://x.com/nichxbt
 * @github https://github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  momentumStrategy,
  awesomeOscillatorStrategy,
  ichimokuCloudStrategy,
  rsi2Strategy,
  stochasticOscillatorStrategy,
  williamsRStrategy,
} from "indicatorts";
import { fetchOhlcvData } from "../utils/fetchOhlcv.js";

const symbolSchema = z.string().describe("Trading pair, e.g., 'BTC/USDT'");
const timeframeSchema = z.string().default("1h").describe("Timeframe, e.g., '1m', '1h', '1d'");
const limitSchema = z.number().default(100).describe("Number of OHLCV data points to fetch");
const periodSchema = (defaultVal: number) => z.number().default(defaultVal).describe("Period length");

export function registerMomentumStrategies(server: McpServer): void {
  server.tool(
    "strategy_momentum",
    "Momentum Strategy - trading signals based on price momentum. Returns: -1 (SELL), 0 (HOLD), 1 (BUY)",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = momentumStrategy(asset, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "strategy_ao",
    "Awesome Oscillator Strategy - trading signals based on market momentum. Returns: -1 (SELL), 0 (HOLD), 1 (BUY)",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      fastPeriod: z.number().default(5).describe("Fast period"),
      slowPeriod: z.number().default(34).describe("Slow period"),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, fastPeriod, slowPeriod, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = awesomeOscillatorStrategy(asset, { fast: fastPeriod, slow: slowPeriod });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "strategy_ichimoku",
    "Ichimoku Cloud Strategy - comprehensive trading signals from Ichimoku indicator. Returns: -1 (SELL), 0 (HOLD), 1 (BUY)",
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
        const result = ichimokuCloudStrategy(asset, { conversion: conversionPeriod, base: basePeriod, span: spanPeriod });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "strategy_rsi2",
    "RSI2 Strategy - short-term mean reversion signals using 2-period RSI. Returns: -1 (SELL), 0 (HOLD), 1 (BUY)",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = rsi2Strategy(asset, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "strategy_stochastic",
    "Stochastic Oscillator Strategy - trading signals based on overbought/oversold conditions. Returns: -1 (SELL), 0 (HOLD), 1 (BUY)",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      signalPeriod: z.number().default(3).describe("Signal period"),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, signalPeriod, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = stochasticOscillatorStrategy(asset, { period, signal: signalPeriod });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "strategy_williams_r",
    "Williams %R Strategy - trading signals based on momentum overbought/oversold levels. Returns: -1 (SELL), 0 (HOLD), 1 (BUY)",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = williamsRStrategy(asset, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );
}
