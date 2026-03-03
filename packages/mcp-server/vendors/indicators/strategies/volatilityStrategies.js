/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
const { z } = require("zod");
const {
  accelerationBandsStrategy, bollingerBandsStrategy, projectionOscillatorStrategy,
} = require("indicatorts");
const fetchOhlcvData = require("../utils/fetchOhlcvData");

module.exports = (server) => {
  server.tool(
    "calculate_acceleration_bands_strategy",
    "Calculate the Acceleration Bands Strategy for a given trading pair using Binance OHLCV data. Outputs: -1 (SELL), 0 (HOLD), 1 (BUY)",
    {
      symbol: z.string().describe("Trading pair, e.g., 'BTC/USDT'"),
      timeframe: z.string().default("1h").describe("Timeframe, e.g., '1m', '1h', '1d'"),
      period: z.number().default(20).describe("Period length for AB"),
      limit: z.number().default(100).describe("Number of OHLCV data points to fetch"),
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = accelerationBandsStrategy(asset, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "calculate_bollinger_bands_strategy",
    "Calculate the Bollinger Bands Strategy for a given trading pair using Binance OHLCV data. Outputs: -1 (SELL), 0 (HOLD), 1 (BUY)",
    {
      symbol: z.string().describe("Trading pair, e.g., 'BTC/USDT'"),
      timeframe: z.string().default("1h").describe("Timeframe, e.g., '1m', '1h', '1d'"),
      period: z.number().default(20).describe("Period length for BB"),
      stdDev: z.number().default(2).describe("Standard deviation multiplier"),
      limit: z.number().default(100).describe("Number of OHLCV data points to fetch"),
    },
    async ({ symbol, timeframe, period, stdDev, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = bollingerBandsStrategy(asset, { period, stdDev });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "calculate_projection_oscillator_strategy",
    "Calculate the Projection Oscillator Strategy for a given trading pair using Binance OHLCV data. Outputs: -1 (SELL), 0 (HOLD), 1 (BUY)",
    {
      symbol: z.string().describe("Trading pair, e.g., 'BTC/USDT'"),
      timeframe: z.string().default("1h").describe("Timeframe, e.g., '1m', '1h', '1d'"),
      period: z.number().default(14).describe("Period length for PO"),
      limit: z.number().default(100).describe("Number of OHLCV data points to fetch"),
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = projectionOscillatorStrategy(asset, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );
};