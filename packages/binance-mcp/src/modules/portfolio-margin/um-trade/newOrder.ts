/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/portfolio-margin/um-trade/newOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginUmNewOrder(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginUmNewOrder",
        "Place a new USDT-M Futures order in Portfolio Margin mode. ⚠️ HIGH RISK: Futures trading involves leverage.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., 'BTCUSDT')"),
            side: z.enum(["BUY", "SELL"]).describe("Order side"),
            type: z.enum(["LIMIT", "MARKET", "STOP", "STOP_MARKET", "TAKE_PROFIT", "TAKE_PROFIT_MARKET", "TRAILING_STOP_MARKET"])
                .describe("Order type"),
            quantity: z.string().optional().describe("Order quantity"),
            price: z.string().optional().describe("Limit price (required for LIMIT orders)"),
            stopPrice: z.string().optional().describe("Stop price (required for STOP orders)"),
            timeInForce: z.enum(["GTC", "IOC", "FOK", "GTX"]).optional().describe("Time in force"),
            reduceOnly: z.boolean().optional().describe("Reduce position only"),
            newClientOrderId: z.string().optional().describe("Custom client order ID"),
            positionSide: z.enum(["BOTH", "LONG", "SHORT"]).optional().describe("Position side for hedge mode"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await portfolioMarginClient.restAPI.umNewOrder({
                    symbol: params.symbol,
                    side: params.side,
                    type: params.type,
                    ...(params.quantity && { quantity: params.quantity }),
                    ...(params.price && { price: params.price }),
                    ...(params.stopPrice && { stopPrice: params.stopPrice }),
                    ...(params.timeInForce && { timeInForce: params.timeInForce }),
                    ...(params.reduceOnly !== undefined && { reduceOnly: params.reduceOnly }),
                    ...(params.newClientOrderId && { newClientOrderId: params.newClientOrderId }),
                    ...(params.positionSide && { positionSide: params.positionSide }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Portfolio Margin UM Order Placed!\n\nOrder ID: ${data.orderId}\nSymbol: ${data.symbol}\nSide: ${data.side}\nType: ${data.type}\nQuantity: ${data.origQty}\nPrice: ${data.price || 'MARKET'}\nStatus: ${data.status}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to place Portfolio Margin UM order: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
