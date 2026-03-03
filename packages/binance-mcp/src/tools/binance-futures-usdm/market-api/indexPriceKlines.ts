/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/market-api/indexPriceKlines.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesIndexPriceKlines(server: McpServer) {
    server.tool(
        "BinanceFuturesIndexPriceKlines",
        "Get index price kline data for USD-M Futures.",
        {
            pair: z.string().describe("Underlying pair (e.g., BTCUSDT)"),
            interval: z.enum([
                "1m", "3m", "5m", "15m", "30m", 
                "1h", "2h", "4h", "6h", "8h", "12h",
                "1d", "3d", "1w", "1M"
            ]).describe("Kline interval"),
            startTime: z.number().int().optional().describe("Start timestamp in ms"),
            endTime: z.number().int().optional().describe("End timestamp in ms"),
            limit: z.number().int().optional().describe("Number of klines. Default 500, max 1500")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.indexPriceKlines({
                    pair: params.pair,
                    interval: params.interval,
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Index Price Klines for ${params.pair}: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get index price klines: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
