// src/tools/binance-futures-usdm/markPriceKlines.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMMarkPriceKlines(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMMarkPriceKlines",
        "Get mark price Kline/candlestick data for USD-M Futures.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            interval: z.enum([
                "1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"
            ]).describe("Kline interval"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            limit: z.number().optional().describe("Default 500; max 1500")
        },
        async ({ symbol, interval, startTime, endTime, limit }) => {
            try {
                const params: any = { symbol, interval };
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (limit !== undefined) params.limit = limit;

                const data = await futuresClient.markPriceKlines(params);
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved ${data.length || 0} mark price klines for USD-M Futures ${symbol} with ${interval} interval. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve USD-M Futures mark price klines: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
