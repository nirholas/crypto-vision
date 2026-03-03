/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/portfolio-margin/margin-trade/cancelOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginMarginCancelOrder(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginMarginCancelOrder",
        "Cancel an active cross margin order in Portfolio Margin mode.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., 'BTCUSDT')"),
            orderId: z.number().int().optional().describe("Order ID to cancel"),
            origClientOrderId: z.string().optional().describe("Original client order ID to cancel"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                if (!params.orderId && !params.origClientOrderId) {
                    return {
                        content: [{
                            type: "text",
                            text: `❌ Either orderId or origClientOrderId must be provided`
                        }],
                        isError: true
                    };
                }
                
                const response = await portfolioMarginClient.restAPI.marginCancelOrder({
                    symbol: params.symbol,
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.origClientOrderId && { origClientOrderId: params.origClientOrderId }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Portfolio Margin Margin Order Cancelled!\n\nOrder ID: ${data.orderId}\nSymbol: ${data.symbol}\nStatus: ${data.status}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to cancel Portfolio Margin margin order: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
