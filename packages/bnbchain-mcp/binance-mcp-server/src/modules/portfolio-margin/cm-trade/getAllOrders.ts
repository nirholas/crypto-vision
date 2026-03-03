/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/portfolio-margin/cm-trade/getAllOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginCmGetAllOrders(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginCmGetAllOrders",
        "Get all COIN-M Futures orders (active, cancelled, filled) in Portfolio Margin mode.",
        {
            symbol: z.string().optional().describe("Trading pair symbol (e.g., 'BTCUSD_PERP')"),
            pair: z.string().optional().describe("Trading pair (e.g., 'BTCUSD')"),
            orderId: z.number().int().optional().describe("Order ID to start from"),
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            limit: z.number().int().min(1).max(1000).optional().describe("Number of orders to return (default 500, max 1000)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await portfolioMarginClient.restAPI.cmAllOrders({
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.pair && { pair: params.pair }),
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Portfolio Margin CM All Orders\n\n`;
                
                if (Array.isArray(data) && data.length > 0) {
                    result += `Total orders: ${data.length}\n\n`;
                    data.slice(0, 20).forEach((order: any, index: number) => {
                        result += `**${index + 1}. ${order.symbol}**\n`;
                        result += `  Order ID: ${order.orderId}\n`;
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
                        text: `❌ Failed to get Portfolio Margin CM orders: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
