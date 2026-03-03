// src/tools/binance-options/openOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsOpenOrders(server: McpServer) {
    server.tool(
        "BinanceOptionsOpenOrders",
        "Get all open options orders.",
        {
            symbol: z.string().optional().describe("Option trading symbol (e.g., BTC-240126-42000-C)")
        },
        async ({ symbol }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;
                
                const data = await optionsClient.openOrders(params);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Open orders retrieved. Count: ${Array.isArray(data) ? data.length : 0}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get open orders: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
