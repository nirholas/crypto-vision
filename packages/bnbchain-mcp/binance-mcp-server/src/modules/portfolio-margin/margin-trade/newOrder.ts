/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/portfolio-margin/margin-trade/newOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginMarginNewOrder(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginMarginNewOrder",
        "Place a new cross margin order in Portfolio Margin mode. ⚠️ Margin trading involves borrowing and interest.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., 'BTCUSDT')"),
            side: z.enum(["BUY", "SELL"]).describe("Order side"),
            type: z.enum(["LIMIT", "MARKET", "STOP_LOSS", "STOP_LOSS_LIMIT", "TAKE_PROFIT", "TAKE_PROFIT_LIMIT", "LIMIT_MAKER"])
                .describe("Order type"),
            quantity: z.string().optional().describe("Order quantity"),
            quoteOrderQty: z.string().optional().describe("Quote quantity (for MARKET orders)"),
            price: z.string().optional().describe("Limit price"),
            stopPrice: z.string().optional().describe("Stop price"),
            timeInForce: z.enum(["GTC", "IOC", "FOK"]).optional().describe("Time in force"),
            newClientOrderId: z.string().optional().describe("Custom client order ID"),
            sideEffectType: z.enum(["NO_SIDE_EFFECT", "MARGIN_BUY", "AUTO_REPAY", "AUTO_BORROW_REPAY"]).optional()
                .describe("Side effect type for margin orders"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await portfolioMarginClient.restAPI.marginNewOrder({
                    symbol: params.symbol,
                    side: params.side,
                    type: params.type,
                    ...(params.quantity && { quantity: params.quantity }),
                    ...(params.quoteOrderQty && { quoteOrderQty: params.quoteOrderQty }),
                    ...(params.price && { price: params.price }),
                    ...(params.stopPrice && { stopPrice: params.stopPrice }),
                    ...(params.timeInForce && { timeInForce: params.timeInForce }),
                    ...(params.newClientOrderId && { newClientOrderId: params.newClientOrderId }),
                    ...(params.sideEffectType && { sideEffectType: params.sideEffectType }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Portfolio Margin Margin Order Placed!\n\nOrder ID: ${data.orderId}\nSymbol: ${data.symbol}\nSide: ${data.side}\nType: ${data.type}\nQuantity: ${data.origQty}\nPrice: ${data.price || 'MARKET'}\nStatus: ${data.status}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to place Portfolio Margin margin order: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
