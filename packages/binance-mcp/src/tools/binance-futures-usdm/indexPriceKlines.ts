// src/tools/binance-futures-usdm/indexPriceKlines.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMIndexPriceKlines(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMIndexPriceKlines",
        "Get index price Kline/candlestick data for USD-M Futures.",
        {
            pair: z.string().describe("Trading pair (e.g., BTCUSDT)"),
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

                const data = await futuresClient.indexPriceKlines(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved ${data.length || 0} index price klines for USD-M Futures ${pair} with ${interval} interval. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve USD-M Futures index price klines: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
