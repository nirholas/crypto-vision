// src/tools/binance-options/trades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsTrades(server: McpServer) {
    server.tool(
        "BinanceOptionsTrades",
        "Get recent trades for an option symbol.",
        {
            symbol: z.string().describe("Option trading symbol (e.g., BTC-240126-42000-C)"),
            limit: z.number().optional().describe("Number of trades to return. Default 100; max 500.")
        },
        async ({ symbol, limit }) => {
            try {
                const params: any = { symbol };
                if (limit !== undefined) params.limit = limit;
                
                const data = await optionsClient.trades(params);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Recent trades for ${symbol}. Count: ${Array.isArray(data) ? data.length : 0}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get recent trades: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
