/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/portfolio-margin/um-trade/getOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginUmGetOrder(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginUmGetOrder",
        "Query a specific USDT-M Futures order in Portfolio Margin mode.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., 'BTCUSDT')"),
            orderId: z.number().int().optional().describe("Order ID to query"),
            origClientOrderId: z.string().optional().describe("Original client order ID to query"),
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
                
                const response = await portfolioMarginClient.restAPI.umOrder({
                    symbol: params.symbol,
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.origClientOrderId && { origClientOrderId: params.origClientOrderId }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Portfolio Margin UM Order Details\n\n`;
                result += `Order ID: ${data.orderId}\n`;
                result += `Symbol: ${data.symbol}\n`;
                result += `Side: ${data.side} | Type: ${data.type}\n`;
                result += `Price: ${data.price} | Qty: ${data.origQty}\n`;
                result += `Executed Qty: ${data.executedQty}\n`;
                result += `Avg Price: ${data.avgPrice}\n`;
                result += `Status: ${data.status}\n`;
                result += `Time: ${new Date(data.time).toISOString()}`;
                
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
                        text: `❌ Failed to get Portfolio Margin UM order: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
