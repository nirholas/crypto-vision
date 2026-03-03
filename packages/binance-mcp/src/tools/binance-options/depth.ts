// src/tools/binance-options/depth.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsDepth(server: McpServer) {
    server.tool(
        "BinanceOptionsDepth",
        "Get order book depth for an option symbol.",
        {
            symbol: z.string().describe("Option trading symbol (e.g., BTC-240126-42000-C)"),
            limit: z.number().optional().describe("Depth limit. Default 100; max 1000.")
        },
        async ({ symbol, limit }) => {
            try {
                const params: any = { symbol };
                if (limit !== undefined) params.limit = limit;
                
                const data = await optionsClient.depth(params);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Order book depth for ${symbol}. Bids: ${data.bids?.length || 0}, Asks: ${data.asks?.length || 0}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get order book depth: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
