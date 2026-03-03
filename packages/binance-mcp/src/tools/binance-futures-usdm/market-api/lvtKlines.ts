/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/market-api/lvtKlines.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesLvtKlines(server: McpServer) {
    server.tool(
        "BinanceFuturesLvtKlines",
        "Get historical BLVT NAV Kline/candlestick data.",
        {
            symbol: z.string().describe("BLVT symbol (e.g., BTCDOWN, BTCUP)"),
            interval: z.enum([
                "1m", "3m", "5m", "15m", "30m", 
                "1h", "2h", "4h", "6h", "8h", "12h", 
                "1d", "3d", "1w", "1M"
            ]).describe("Kline interval"),
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            limit: z.number().int().max(1000).optional().describe("Number of klines. Default 500, max 1000")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.lvtKlines({
                    symbol: params.symbol,
                    interval: params.interval,
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `LVT klines for ${params.symbol} (${params.interval}): ${Array.isArray(data) ? data.length : 0} candles. ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get LVT klines: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
