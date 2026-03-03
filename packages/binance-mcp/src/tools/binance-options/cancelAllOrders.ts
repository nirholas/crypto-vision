// src/tools/binance-options/cancelAllOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsCancelAllOrders(server: McpServer) {
    server.tool(
        "BinanceOptionsCancelAllOrders",
        "Cancel all open options orders for a symbol.",
        {
            symbol: z.string().describe("Option trading symbol (e.g., BTC-240126-42000-C)")
        },
        async ({ symbol }) => {
            try {
                const params: any = { symbol };
                
                const data = await optionsClient.cancelAllOrders(params);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `All orders cancelled successfully. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to cancel all orders: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
