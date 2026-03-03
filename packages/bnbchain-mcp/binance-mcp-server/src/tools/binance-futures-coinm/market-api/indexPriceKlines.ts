/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-coinm/market-api/indexPriceKlines.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryIndexPriceKlines(server: McpServer) {
    server.tool(
        "BinanceDeliveryIndexPriceKlines",
        "Get index price kline/candlestick data for a COIN-M Futures pair.",
        {
            pair: z.string().describe("Underlying pair (e.g., BTCUSD)"),
            interval: z.enum([
                "1m", "3m", "5m", "15m", "30m",
                "1h", "2h", "4h", "6h", "8h", "12h",
                "1d", "3d", "1w", "1M"
            ]).describe("Kline interval"),
            startTime: z.number().int().optional().describe("Start timestamp in milliseconds"),
            endTime: z.number().int().optional().describe("End timestamp in milliseconds"),
            limit: z.number().int().optional().describe("Number of klines (default 500, max 1500)")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.indexPriceKlines({
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
                        text: `📈 Index Price Klines for ${params.pair} (${params.interval})\n\nCandles: ${Array.isArray(data) ? data.length : 0}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get index price klines: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
