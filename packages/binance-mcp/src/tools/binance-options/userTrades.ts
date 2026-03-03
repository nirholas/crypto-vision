// src/tools/binance-options/userTrades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsUserTrades(server: McpServer) {
    server.tool(
        "BinanceOptionsUserTrades",
        "Get options account trade list.",
        {
            symbol: z.string().optional().describe("Option trading symbol (e.g., BTC-240126-42000-C)"),
            fromId: z.number().optional().describe("Trade ID to fetch from"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            limit: z.number().optional().describe("Number of trades to return. Default 100; max 1000.")
        },
        async ({ symbol, fromId, startTime, endTime, limit }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;
                if (fromId !== undefined) params.fromId = fromId;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (limit !== undefined) params.limit = limit;
                
                const data = await optionsClient.userTrades(params);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `User trades retrieved. Count: ${Array.isArray(data) ? data.length : 0}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get user trades: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
