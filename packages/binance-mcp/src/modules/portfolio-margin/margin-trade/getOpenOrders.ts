/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/portfolio-margin/margin-trade/getOpenOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginMarginGetOpenOrders(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginMarginGetOpenOrders",
        "Get all open cross margin orders in Portfolio Margin mode.",
        {
            symbol: z.string().optional().describe("Trading pair symbol to filter by"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await portfolioMarginClient.restAPI.marginOpenOrders({
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Portfolio Margin Margin Open Orders\n\n`;
                
                if (Array.isArray(data) && data.length > 0) {
                    result += `Total open orders: ${data.length}\n\n`;
                    data.forEach((order: any, index: number) => {
                        result += `**${index + 1}. ${order.symbol}**\n`;
                        result += `  Order ID: ${order.orderId}\n`;
                        result += `  Side: ${order.side} | Type: ${order.type}\n`;
                        result += `  Price: ${order.price} | Qty: ${order.origQty}\n`;
                        result += `  Executed: ${order.executedQty}\n`;
                        result += `  Status: ${order.status}\n\n`;
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
                        text: `❌ Failed to get Portfolio Margin margin open orders: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
