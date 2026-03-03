/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/options/trade-api/batchOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerOptionsBatchOrders(server: McpServer) {
    server.tool(
        "BinanceOptionsBatchOrders",
        "Place multiple options orders in a single request. Maximum 5 orders per request. ⚠️ HIGH RISK: Options can expire worthless.",
        {
            orders: z.array(z.object({
                symbol: z.string().describe("Option symbol"),
                side: z.enum(["BUY", "SELL"]).describe("Order side"),
                type: z.enum(["LIMIT"]).describe("Order type"),
                quantity: z.string().describe("Number of contracts"),
                price: z.string().describe("Limit price"),
                timeInForce: z.enum(["GTC", "IOC", "FOK"]).optional(),
                reduceOnly: z.boolean().optional(),
                postOnly: z.boolean().optional(),
                newClientOrderId: z.string().optional()
            })).min(1).max(5).describe("Array of orders (max 5)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await optionsClient.restAPI.batchOrders({
                    orders: JSON.stringify(params.orders),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Batch Options Orders Placed\n\n`;
                
                if (Array.isArray(data)) {
                    data.forEach((order: any, index: number) => {
                        if (order.orderId) {
                            result += `Order ${index + 1}: ✅ Success\n`;
                            result += `  Order ID: ${order.orderId}\n`;
                            result += `  Symbol: ${order.symbol}\n`;
                            result += `  Side: ${order.side} | Qty: ${order.quantity}\n`;
                            result += `  Price: ${order.price} | Status: ${order.status}\n\n`;
                        } else {
                            result += `Order ${index + 1}: ❌ Failed\n`;
                            result += `  Error: ${order.msg || 'Unknown error'}\n\n`;
                        }
                    });
                }
                
                return {
                    content: [{
                        type: "text",
                        text: result
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to place batch options orders: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
