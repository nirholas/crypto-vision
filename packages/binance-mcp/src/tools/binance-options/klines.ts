// src/tools/binance-options/klines.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsKlines(server: McpServer) {
    server.tool(
        "BinanceOptionsKlines",
        "Get kline/candlestick data for an option symbol.",
        {
            symbol: z.string().describe("Option trading symbol (e.g., BTC-240126-42000-C)"),
            interval: z.enum(["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d", "3d", "1w"]).describe("Kline interval"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            limit: z.number().optional().describe("Number of klines to return. Default 500; max 1500.")
        },
        async ({ symbol, interval, startTime, endTime, limit }) => {
            try {
                const params: any = { symbol, interval };
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (limit !== undefined) params.limit = limit;
                
                const data = await optionsClient.klines(params);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Klines for ${symbol}. Count: ${Array.isArray(data) ? data.length : 0}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get klines: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
