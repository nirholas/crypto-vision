// src/tools/binance-spot/market-api/klines.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spotClient } from "../../../config/binanceClient.js";

export function registerBinanceKlines(server: McpServer) {
    server.tool(
        "BinanceKlines",
        "Get candlestick data (klines) for a specific trading pair and interval.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            interval: z.enum([
                "1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"
            ]).describe("Kline interval"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            limit: z.number().optional().describe("Default 500; max 1000")
        },
        async ({ symbol, interval, startTime, endTime, limit }) => {
            try {
                const params: any = { 
                    symbol,
                    interval
                };
                
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (limit !== undefined) params.limit = limit;
                
                const response = await spotClient.restAPI.klines(params);

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved klines for ${symbol} with ${interval} interval. Total candles: ${data.length}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve klines: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}