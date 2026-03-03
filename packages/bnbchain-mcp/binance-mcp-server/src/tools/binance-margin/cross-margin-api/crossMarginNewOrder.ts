/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/cross-margin-api/crossMarginNewOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginNewOrder(server: McpServer) {
    server.tool(
        "BinanceCrossMarginNewOrder",
        "Place a new order in Cross Margin account. Supports various order types including LIMIT, MARKET, STOP_LOSS, TAKE_PROFIT, etc.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            side: z.enum(["BUY", "SELL"]).describe("Order side"),
            type: z.enum([
                "LIMIT", "MARKET", "STOP_LOSS", "STOP_LOSS_LIMIT", 
                "TAKE_PROFIT", "TAKE_PROFIT_LIMIT", "LIMIT_MAKER"
            ]).describe("Order type"),
            quantity: z.number().optional().describe("Order quantity"),
            quoteOrderQty: z.number().optional().describe("Quote order quantity for MARKET orders"),
            price: z.number().optional().describe("Order price (required for LIMIT orders)"),
            stopPrice: z.number().optional().describe("Stop price for stop orders"),
            timeInForce: z.enum(["GTC", "IOC", "FOK"]).optional().describe("Time in force"),
            newClientOrderId: z.string().optional().describe("Unique order ID"),
            icebergQty: z.number().optional().describe("Iceberg quantity"),
            newOrderRespType: z.enum(["ACK", "RESULT", "FULL"]).optional().describe("Response type"),
            sideEffectType: z.enum(["NO_SIDE_EFFECT", "MARGIN_BUY", "AUTO_REPAY", "AUTO_BORROW_REPAY"]).optional()
                .describe("Side effect type for margin orders"),
            isIsolated: z.enum(["TRUE", "FALSE"]).optional().describe("For isolated margin, default FALSE"),
            selfTradePreventionMode: z.enum(["EXPIRE_TAKER", "EXPIRE_MAKER", "EXPIRE_BOTH", "NONE"]).optional()
                .describe("Self-trade prevention mode"),
            autoRepayAtCancel: z.boolean().optional().describe("Auto repay when order is canceled"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.marginAccountNewOrder({
                    symbol: params.symbol,
                    side: params.side,
                    type: params.type,
                    ...(params.quantity !== undefined && { quantity: params.quantity }),
                    ...(params.quoteOrderQty !== undefined && { quoteOrderQty: params.quoteOrderQty }),
                    ...(params.price !== undefined && { price: params.price }),
                    ...(params.stopPrice !== undefined && { stopPrice: params.stopPrice }),
                    ...(params.timeInForce && { timeInForce: params.timeInForce }),
                    ...(params.newClientOrderId && { newClientOrderId: params.newClientOrderId }),
                    ...(params.icebergQty !== undefined && { icebergQty: params.icebergQty }),
                    ...(params.newOrderRespType && { newOrderRespType: params.newOrderRespType }),
                    ...(params.sideEffectType && { sideEffectType: params.sideEffectType }),
                    ...(params.isIsolated && { isIsolated: params.isIsolated }),
                    ...(params.selfTradePreventionMode && { selfTradePreventionMode: params.selfTradePreventionMode }),
                    ...(params.autoRepayAtCancel !== undefined && { autoRepayAtCancel: params.autoRepayAtCancel }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Cross Margin order placed successfully: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to place margin order: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
