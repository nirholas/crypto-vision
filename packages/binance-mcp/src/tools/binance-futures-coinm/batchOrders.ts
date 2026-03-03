// src/tools/binance-futures-coinm/batchOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deliveryClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesCOINMBatchOrders(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMBatchOrders",
        "Place multiple orders for COIN-M Futures (max 5 orders).",
        {
            batchOrders: z.string().describe("JSON string of order list. Max 5 orders. Each order has: symbol, side, type, and optional parameters")
        },
        async ({ batchOrders }) => {
            try {
                const data = await deliveryClient.batchOrders({ batchOrders });
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `COIN-M Futures batch orders created. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to create COIN-M Futures batch orders: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
