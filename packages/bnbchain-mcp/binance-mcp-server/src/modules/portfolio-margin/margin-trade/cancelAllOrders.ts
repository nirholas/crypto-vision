/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/portfolio-margin/margin-trade/cancelAllOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginMarginCancelAllOrders(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginMarginCancelAllOrders",
        "Cancel all open cross margin orders for a symbol in Portfolio Margin mode. ⚠️ This will cancel ALL open orders.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., 'BTCUSDT')"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await portfolioMarginClient.restAPI.marginCancelAllOpenOrders({
                    symbol: params.symbol,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ All Portfolio Margin margin orders cancelled for ${params.symbol}\n\nResponse: ${JSON.stringify(data)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to cancel all Portfolio Margin margin orders: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
