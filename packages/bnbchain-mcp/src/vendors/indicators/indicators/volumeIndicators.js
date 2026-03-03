/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
const { z } = require("zod");
const {
  accumulationDistribution, chaikinMoneyFlow, easeOfMovement, forceIndex,
  moneyFlowIndex, negativeVolumeIndex, onBalanceVolume, volumePriceTrend,
  volumeWeightedAveragePrice,
} = require("indicatorts");
const fetchOhlcvData = require("../utils/fetchOhlcvData");

module.exports = (server) => {
  server.tool(
    "calculate_accumulation_distribution",
    "Calculate the Accumulation/Distribution (AD) for a given trading pair using Binance OHLCV data",
    {
      symbol: z.string().describe("Trading pair, e.g., 'BTC/USDT'"),
      timeframe: z.string().default("1h").describe("Timeframe, e.g., '1m', '1h', '1d'"),
      limit: z.number().default(100).describe("Number of OHLCV data points to fetch"),
    },
    async ({ symbol, timeframe, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = accumulationDistribution(asset.highs, asset.lows, asset.closings, asset.volumes);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "calculate_chaikin_money_flow",
    "Calculate the Chaikin Money Flow (CMF) for a given trading pair using Binance OHLCV data",
    {
      symbol: z.string().describe("Trading pair, e.g., 'BTC/USDT'"),
      timeframe: z.string().default("1h").describe("Timeframe, e.g., '1m', '1h', '1d'"),
      period: z.number().default(20).describe("Period length for CMF"),
      limit: z.number().default(100).describe("Number of OHLCV data points to fetch"),
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = chaikinMoneyFlow(asset.highs, asset.lows, asset.closings, asset.volumes, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "calculate_ease_of_movement",
    "Calculate the Ease of Movement (EMV) for a given trading pair using Binance OHLCV data",
    {
      symbol: z.string().describe("Trading pair, e.g., 'BTC/USDT'"),
      timeframe: z.string().default("1h").describe("Timeframe, e.g., '1m', '1h', '1d'"),
      period: z.number().default(14).describe("Period length for EMV"),
      limit: z.number().default(100).describe("Number of OHLCV data points to fetch"),
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = easeOfMovement(asset.highs, asset.lows, asset.volumes, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "calculate_force_index",
    "Calculate the Force Index (FI) for a given trading pair using Binance OHLCV data",
    {
      symbol: z.string().describe("Trading pair, e.g., 'BTC/USDT'"),
      timeframe: z.string().default("1h").describe("Timeframe, e.g., '1m', '1h', '1d'"),
      period: z.number().default(13).describe("Period length for FI"),
      limit: z.number().default(100).describe("Number of OHLCV data points to fetch"),
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = forceIndex(asset.closings, asset.volumes, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "calculate_money_flow_index",
    "Calculate the Money Flow Index (MFI) for a given trading pair using Binance OHLCV data",
    {
      symbol: z.string().describe("Trading pair, e.g., 'BTC/USDT'"),
      timeframe: z.string().default("1h").describe("Timeframe, e.g., '1m', '1h', '1d'"),
      period: z.number().default(14).describe("Period length for MFI"),
      limit: z.number().default(100).describe("Number of OHLCV data points to fetch"),
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = moneyFlowIndex(asset.highs, asset.lows, asset.closings, asset.volumes, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "calculate_negative_volume_index",
    "Calculate the Negative Volume Index (NVI) for a given trading pair using Binance OHLCV data",
    {
      symbol: z.string().describe("Trading pair, e.g., 'BTC/USDT'"),
      timeframe: z.string().default("1h").describe("Timeframe, e.g., '1m', '1h', '1d'"),
      limit: z.number().default(100).describe("Number of OHLCV data points to fetch"),
    },
    async ({ symbol, timeframe, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = negativeVolumeIndex(asset.closings, asset.volumes);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "calculate_on_balance_volume",
    "Calculate the On-Balance Volume (OBV) for a given trading pair using Binance OHLCV data",
    {
      symbol: z.string().describe("Trading pair, e.g., 'BTC/USDT'"),
      timeframe: z.string().default("1h").describe("Timeframe, e.g., '1m', '1h', '1d'"),
      limit: z.number().default(100).describe("Number of OHLCV data points to fetch"),
    },
    async ({ symbol, timeframe, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = onBalanceVolume(asset.closings, asset.volumes);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "calculate_volume_price_trend",
    "Calculate the Volume Price Trend (VPT) for a given trading pair using Binance OHLCV data",
    {
      symbol: z.string().describe("Trading pair, e.g., 'BTC/USDT'"),
      timeframe: z.string().default("1h").describe("Timeframe, e.g., '1m', '1h', '1d'"),
      limit: z.number().default(100).describe("Number of OHLCV data points to fetch"),
    },
    async ({ symbol, timeframe, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = volumePriceTrend(asset.closings, asset.volumes);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );

  server.tool(
    "calculate_volume_weighted_average_price",
    "Calculate the Volume Weighted Average Price (VWAP) for a given trading pair using Binance OHLCV data",
    {
      symbol: z.string().describe("Trading pair, e.g., 'BTC/USDT'"),
      timeframe: z.string().default("1h").describe("Timeframe, e.g., '1m', '1h', '1d'"),
      limit: z.number().default(100).describe("Number of OHLCV data points to fetch"),
    },
    async ({ symbol, timeframe, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = volumeWeightedAveragePrice(asset.highs, asset.lows, asset.closings, asset.volumes);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
      }
    }
  );
};