/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/options/trade-api/getHistoryOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerOptionsGetHistoryOrders(server: McpServer) {
    server.tool(
        "BinanceOptionsGetHistoryOrders",
        "Get historical options orders. Returns filled, cancelled, and expired orders.",
        {
            symbol: z.string().describe("Option symbol (e.g., 'BTC-240126-40000-C')"),
            orderId: z.number().int().optional().describe("Order ID to start from"),
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            limit: z.number().int().min(1).max(1000).optional().describe("Number of orders to return (default 500, max 1000)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await optionsClient.restAPI.historyOrders({
                    symbol: params.symbol,
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Options Order History - ${params.symbol}\n\n`;
                
                if (Array.isArray(data) && data.length > 0) {
                    result += `Total orders: ${data.length}\n\n`;
                    data.slice(0, 20).forEach((order: any, index: number) => {
                        result += `**${index + 1}. Order ID: ${order.orderId}**\n`;
                        result += `  Side: ${order.side} | Type: ${order.type}\n`;
                        result += `  Price: ${order.price} | Qty: ${order.quantity}\n`;
                        result += `  Executed Qty: ${order.executedQty}\n`;
                        result += `  Avg Price: ${order.avgPrice}\n`;
                        result += `  Status: ${order.status}\n`;
                        result += `  Time: ${new Date(order.createTime).toISOString()}\n\n`;
                    });
                    if (data.length > 20) {
                        result += `... and ${data.length - 20} more orders`;
                    }
                } else {
                    result += `No historical orders found`;
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
                        text: `❌ Failed to get options order history: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
