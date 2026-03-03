// src/tools/binance-options/historicalTrades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsHistoricalTrades(server: McpServer) {
    server.tool(
        "BinanceOptionsHistoricalTrades",
        "Get historical trades for an option symbol.",
        {
            symbol: z.string().describe("Option trading symbol (e.g., BTC-240126-42000-C)"),
            fromId: z.number().optional().describe("Trade ID to fetch from"),
            limit: z.number().optional().describe("Number of trades to return. Default 100; max 500.")
        },
        async ({ symbol, fromId, limit }) => {
            try {
                const params: any = { symbol };
                if (fromId !== undefined) params.fromId = fromId;
                if (limit !== undefined) params.limit = limit;
                
                const data = await optionsClient.historicalTrades(params);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Historical trades for ${symbol}. Count: ${Array.isArray(data) ? data.length : 0}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get historical trades: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
