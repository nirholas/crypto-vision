// src/tools/binance-options/batchOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsBatchOrders(server: McpServer) {
    server.tool(
        "BinanceOptionsBatchOrders",
        "Place multiple options orders in batch.",
        {
            orders: z.string().describe("JSON array of orders, each containing symbol, side, type, quantity, and optionally price, timeInForce, reduceOnly, postOnly, clientOrderId")
        },
        async ({ orders }) => {
            try {
                const params: any = { orders };
                
                const data = await optionsClient.batchOrders(params);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Batch orders placed successfully. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to place batch orders: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
