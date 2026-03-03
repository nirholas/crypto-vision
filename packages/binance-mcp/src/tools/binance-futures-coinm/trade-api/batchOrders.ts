/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/trade-api/batchOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryBatchOrders(server: McpServer) {
    server.tool(
        "BinanceDeliveryBatchOrders",
        "Place multiple COIN-M Futures orders in batch (max 5 orders).",
        {
            batchOrders: z.string().describe("JSON string array of orders. Each order must have: symbol, side, type")
        },
        async (params) => {
            try {
                const orders = JSON.parse(params.batchOrders);
                
                if (!Array.isArray(orders) || orders.length === 0 || orders.length > 5) {
                    return {
                        content: [{ type: "text", text: "Error: batchOrders must be an array of 1-5 orders" }],
                        isError: true
                    };
                }

                const response = await deliveryClient.restAPI.placeMultipleOrders({ batchOrders: orders });
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Batch orders placed!\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to place batch orders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
