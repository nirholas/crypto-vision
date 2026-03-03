/**
 * Volume Indicators Module
 * 
 * @author nich
 * @website https://x.com/nichxbt
 * @github https://github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  accumulationDistribution,
  chaikinMoneyFlow,
  easeOfMovement,
  forceIndex,
  moneyFlowIndex,
  negativeVolumeIndex,
  onBalanceVolume,
  volumePriceTrend,
  volumeWeightedAveragePrice,
} from "indicatorts";
import { fetchOhlcvData } from "./utils/fetchOhlcv.js";

const symbolSchema = z.string().describe("Trading pair, e.g., 'BTC/USDT'");
const timeframeSchema = z.string().default("1h").describe("Timeframe, e.g., '1m', '1h', '1d'");
const limitSchema = z.number().default(100).describe("Number of OHLCV data points to fetch");
const periodSchema = (defaultVal: number) => z.number().default(defaultVal).describe("Period length");

export function registerVolumeIndicators(server: McpServer): void {
  server.tool(
    "indicator_ad",
    "Calculate the Accumulation/Distribution (AD) - measures cumulative money flow volume",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      limit: limitSchema,
    },
    async ({ symbol, timeframe, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = accumulationDistribution(asset.highs, asset.lows, asset.closings, asset.volumes);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_cmf",
    "Calculate the Chaikin Money Flow (CMF) - measures buying/selling pressure over a period",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(20),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = chaikinMoneyFlow(asset.highs, asset.lows, asset.closings, asset.volumes, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_emv",
    "Calculate the Ease of Movement (EMV) - relates volume to price change",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = easeOfMovement(asset.highs, asset.lows, asset.volumes, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_force_index",
    "Calculate the Force Index (FI) - measures the power behind price movements using price and volume",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(13),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = forceIndex(asset.closings, asset.volumes, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_mfi",
    "Calculate the Money Flow Index (MFI) - volume-weighted RSI measuring buying/selling pressure",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      period: periodSchema(14),
      limit: limitSchema,
    },
    async ({ symbol, timeframe, period, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = moneyFlowIndex(asset.highs, asset.lows, asset.closings, asset.volumes, { period });
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_nvi",
    "Calculate the Negative Volume Index (NVI) - tracks price changes on days with decreasing volume",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      limit: limitSchema,
    },
    async ({ symbol, timeframe, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = negativeVolumeIndex(asset.closings, asset.volumes);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_obv",
    "Calculate the On-Balance Volume (OBV) - cumulative volume indicator showing buying/selling pressure",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      limit: limitSchema,
    },
    async ({ symbol, timeframe, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = onBalanceVolume(asset.closings, asset.volumes);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_vpt",
    "Calculate the Volume Price Trend (VPT) - relates volume to price change direction",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      limit: limitSchema,
    },
    async ({ symbol, timeframe, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = volumePriceTrend(asset.closings, asset.volumes);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );

  server.tool(
    "indicator_vwap",
    "Calculate the Volume Weighted Average Price (VWAP) - average price weighted by volume",
    {
      symbol: symbolSchema,
      timeframe: timeframeSchema,
      limit: limitSchema,
    },
    async ({ symbol, timeframe, limit }) => {
      try {
        const asset = await fetchOhlcvData(symbol, timeframe, limit);
        const result = volumeWeightedAveragePrice(asset.highs, asset.lows, asset.closings, asset.volumes);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: `Error: ${(error as Error).message}` }] };
      }
    }
  );
}
