/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/market-api/continuousKlines.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryContinuousKlines(server: McpServer) {
    server.tool(
        "BinanceDeliveryContinuousKlines",
        "Get continuous contract kline/candlestick data for a COIN-M Futures pair. Continuous contract uses the price of the current delivery period contract.",
        {
            pair: z.string().describe("Underlying pair (e.g., BTCUSD)"),
            contractType: z.enum(["PERPETUAL", "CURRENT_QUARTER", "NEXT_QUARTER"]).describe("Contract type"),
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
                const response = await deliveryClient.restAPI.continuousKlines({
                    pair: params.pair,
                    contractType: params.contractType,
                    interval: params.interval,
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `🕯️ Continuous Klines for ${params.pair} ${params.contractType} (${params.interval})\n\nCandles: ${Array.isArray(data) ? data.length : 0}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get continuous klines: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
