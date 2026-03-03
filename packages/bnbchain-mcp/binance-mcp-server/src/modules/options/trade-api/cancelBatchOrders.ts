/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/options/trade-api/cancelBatchOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerOptionsCancelBatchOrders(server: McpServer) {
    server.tool(
        "BinanceOptionsCancelBatchOrders",
        "Cancel multiple options orders in a single request. Maximum 5 orders per request.",
        {
            symbol: z.string().describe("Option symbol (e.g., 'BTC-240126-40000-C')"),
            orderIds: z.array(z.number().int()).optional().describe("Array of order IDs to cancel (max 5)"),
            clientOrderIds: z.array(z.string()).optional().describe("Array of client order IDs to cancel (max 5)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                if (!params.orderIds && !params.clientOrderIds) {
                    return {
                        content: [{
                            type: "text",
                            text: `❌ Either orderIds or clientOrderIds must be provided`
                        }],
                        isError: true
                    };
                }
                
                const response = await optionsClient.restAPI.cancelBatchOrders({
                    symbol: params.symbol,
                    ...(params.orderIds && { orderIds: JSON.stringify(params.orderIds) }),
                    ...(params.clientOrderIds && { clientOrderIds: JSON.stringify(params.clientOrderIds) }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Batch Options Orders Cancelled\n\n`;
                
                if (Array.isArray(data)) {
                    data.forEach((order: any, index: number) => {
                        if (order.orderId && !order.code) {
                            result += `Order ${index + 1}: ✅ Cancelled\n`;
                            result += `  Order ID: ${order.orderId}\n`;
                            result += `  Symbol: ${order.symbol}\n`;
                            result += `  Status: ${order.status}\n\n`;
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
                        text: `❌ Failed to cancel batch options orders: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
