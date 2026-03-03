/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/options/trade-api/getOpenOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerOptionsGetOpenOrders(server: McpServer) {
    server.tool(
        "BinanceOptionsGetOpenOrders",
        "Get all open options orders. Can filter by symbol or underlying asset.",
        {
            symbol: z.string().optional().describe("Option symbol to filter by"),
            underlying: z.string().optional().describe("Underlying asset to filter by (e.g., 'BTCUSDT')"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await optionsClient.restAPI.openOrders({
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.underlying && { underlying: params.underlying }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Open Options Orders\n\n`;
                
                if (Array.isArray(data) && data.length > 0) {
                    result += `Total open orders: ${data.length}\n\n`;
                    data.forEach((order: any, index: number) => {
                        result += `**${index + 1}. ${order.symbol}**\n`;
                        result += `  Order ID: ${order.orderId}\n`;
                        result += `  Side: ${order.side} | Type: ${order.type}\n`;
                        result += `  Price: ${order.price} | Qty: ${order.quantity}\n`;
                        result += `  Executed Qty: ${order.executedQty}\n`;
                        result += `  Status: ${order.status}\n`;
                        result += `  Time: ${new Date(order.createTime).toISOString()}\n\n`;
                    });
                } else {
                    result += `No open orders found`;
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
                        text: `❌ Failed to get open options orders: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
