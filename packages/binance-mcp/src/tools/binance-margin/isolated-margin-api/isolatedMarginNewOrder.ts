// src/tools/binance-margin/isolated-margin-api/isolatedMarginNewOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceIsolatedMarginNewOrder(server: McpServer) {
    server.tool(
        "BinanceIsolatedMarginNewOrder",
        "Post a new order in isolated margin account. Supports various order types including LIMIT, MARKET, STOP_LOSS, etc.",
        {
            symbol: z.string().describe("Isolated margin symbol (e.g., BTCUSDT)"),
            side: z.enum(["BUY", "SELL"]).describe("Order side"),
            type: z.enum(["LIMIT", "MARKET", "STOP_LOSS", "STOP_LOSS_LIMIT", "TAKE_PROFIT", "TAKE_PROFIT_LIMIT", "LIMIT_MAKER"]).describe("Order type"),
            quantity: z.string().optional().describe("Order quantity"),
            quoteOrderQty: z.string().optional().describe("Quote order quantity for MARKET orders"),
            price: z.string().optional().describe("Order price (required for LIMIT orders)"),
            stopPrice: z.string().optional().describe("Stop price for STOP_LOSS and TAKE_PROFIT orders"),
            newClientOrderId: z.string().optional().describe("Unique client order ID"),
            icebergQty: z.string().optional().describe("Iceberg quantity"),
            newOrderRespType: z.enum(["ACK", "RESULT", "FULL"]).optional().describe("Response type"),
            sideEffectType: z.enum(["NO_SIDE_EFFECT", "MARGIN_BUY", "AUTO_REPAY", "AUTO_BORROW_REPAY"]).optional().describe("Side effect type for margin orders"),
            timeInForce: z.enum(["GTC", "IOC", "FOK"]).optional().describe("Time in force"),
            selfTradePreventionMode: z.enum(["EXPIRE_TAKER", "EXPIRE_MAKER", "EXPIRE_BOTH", "NONE"]).optional().describe("Self-trade prevention mode"),
            autoRepayAtCancel: z.boolean().optional().describe("Auto repay at cancel, only for AUTO_BORROW_REPAY"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.newOrder({
                    symbol: params.symbol,
                    isIsolated: "TRUE",
                    side: params.side,
                    type: params.type,
                    ...(params.quantity && { quantity: params.quantity }),
                    ...(params.quoteOrderQty && { quoteOrderQty: params.quoteOrderQty }),
                    ...(params.price && { price: params.price }),
                    ...(params.stopPrice && { stopPrice: params.stopPrice }),
                    ...(params.newClientOrderId && { newClientOrderId: params.newClientOrderId }),
                    ...(params.icebergQty && { icebergQty: params.icebergQty }),
                    ...(params.newOrderRespType && { newOrderRespType: params.newOrderRespType }),
                    ...(params.sideEffectType && { sideEffectType: params.sideEffectType }),
                    ...(params.timeInForce && { timeInForce: params.timeInForce }),
                    ...(params.selfTradePreventionMode && { selfTradePreventionMode: params.selfTradePreventionMode }),
                    ...(params.autoRepayAtCancel !== undefined && { autoRepayAtCancel: params.autoRepayAtCancel }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Isolated margin order placed successfully: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to place isolated margin order: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
