// src/tools/binance-futures-coinm/indexPriceKlines.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deliveryClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesCOINMIndexPriceKlines(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMIndexPriceKlines",
        "Get index price Kline/candlestick data for COIN-M Futures.",
        {
            pair: z.string().describe("Trading pair (e.g., BTCUSD)"),
            interval: z.enum([
                "1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"
            ]).describe("Kline interval"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            limit: z.number().optional().describe("Default 500; max 1500")
        },
        async ({ pair, interval, startTime, endTime, limit }) => {
            try {
                const params: any = { pair, interval };
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (limit !== undefined) params.limit = limit;

                const data = await deliveryClient.indexPriceKlines(params);
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved ${data.length || 0} index price klines for COIN-M Futures ${pair} with ${interval} interval. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve COIN-M Futures index price klines: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
