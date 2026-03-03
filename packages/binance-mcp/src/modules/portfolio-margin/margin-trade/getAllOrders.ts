/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/portfolio-margin/margin-trade/getAllOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginMarginGetAllOrders(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginMarginGetAllOrders",
        "Get all cross margin orders (active, cancelled, filled) in Portfolio Margin mode.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., 'BTCUSDT')"),
            orderId: z.number().int().optional().describe("Order ID to start from"),
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            limit: z.number().int().min(1).max(500).optional().describe("Number of orders to return (default 500, max 500)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await portfolioMarginClient.restAPI.marginAllOrders({
                    symbol: params.symbol,
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Portfolio Margin Margin All Orders - ${params.symbol}\n\n`;
                
                if (Array.isArray(data) && data.length > 0) {
                    result += `Total orders: ${data.length}\n\n`;
                    data.slice(0, 20).forEach((order: any, index: number) => {
                        result += `**${index + 1}. Order ID: ${order.orderId}**\n`;
                        result += `  Side: ${order.side} | Type: ${order.type}\n`;
                        result += `  Price: ${order.price} | Qty: ${order.origQty}\n`;
                        result += `  Executed: ${order.executedQty} | Status: ${order.status}\n\n`;
                    });
                    if (data.length > 20) {
                        result += `... and ${data.length - 20} more orders`;
                    }
                } else {
                    result += `No orders found`;
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
                        text: `❌ Failed to get Portfolio Margin margin orders: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
