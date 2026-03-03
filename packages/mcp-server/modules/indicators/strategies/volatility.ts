/**
 * Volatility Trading Strategies Module
 * 
 * @author nich
 * @website https://x.com/nichxbt
 * @github https://github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  accelerationBandsStrategy,
  bollingerBandsStrategy,
  projectionOscillatorStrategy,
} from "indicatorts";
import { fetchOhlcvData } from "../utils/fetchOhlcv.js";

const symbolSchema = z.string().describe("Trading pair, e.g., 'BTC/USDT'");
const timeframeSchema = z.string().default("1h").describe("Timeframe, e.g., '1m', '1h', '1d'");
const limitSchema = z.number().default(100).describe("Number of OHLCV data points to fetch");
const periodSchema = (defaultVal: number) => z.number().default(defaultVal).describe("Period length");

export function registerVolatilityStrategies(server: McpServer): void {
  server.tool(
    "strategy_acceleration_bands",
    "Acceleration Bands Strategy - trading signals based on volatility breakouts. Returns: -1 (SELL), 0 (HOLD), 1 (BUY)",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(20),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = accelerationBandsStrategy(asset, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "strategy_bollinger_bands",
    "Bollinger Bands Strategy - trading signals based on price breaking through bands. Returns: -1 (SELL), 0 (HOLD), 1 (BUY)",
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
        const result = bollingerBandsStrategy(asset, { period, stdDev });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "strategy_projection_oscillator",
    "Projection Oscillator Strategy - trading signals based on projected trading range. Returns: -1 (SELL), 0 (HOLD), 1 (BUY)",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = projectionOscillatorStrategy(asset, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );
}
