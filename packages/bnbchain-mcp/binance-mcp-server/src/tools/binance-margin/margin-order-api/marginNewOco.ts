/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/margin-order-api/marginNewOco.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceMarginNewOco(server: McpServer) {
    server.tool(
        "BinanceMarginNewOco",
        "Place a new OCO (One-Cancels-the-Other) order in Margin account. Creates both a stop-loss and take-profit order simultaneously. ⚠️ WARNING: OCO orders involve leverage and carry liquidation risk.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            side: z.enum(["BUY", "SELL"]).describe("Order side"),
            quantity: z.number().describe("Order quantity"),
            price: z.number().describe("Limit order price"),
            stopPrice: z.number().describe("Stop loss trigger price"),
            stopLimitPrice: z.number().optional().describe("Stop limit order price (if stop limit order)"),
            stopLimitTimeInForce: z.enum(["GTC", "FOK", "IOC"]).optional().describe("Time in force for stop limit leg"),
            listClientOrderId: z.string().optional().describe("Unique ID for the order list"),
            limitClientOrderId: z.string().optional().describe("Unique ID for the limit order"),
            stopClientOrderId: z.string().optional().describe("Unique ID for the stop order"),
            limitIcebergQty: z.number().optional().describe("Iceberg quantity for limit leg"),
            stopIcebergQty: z.number().optional().describe("Iceberg quantity for stop leg"),
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
                const response = await marginClient.restAPI.marginAccountNewOco({
                    symbol: params.symbol,
                    side: params.side,
                    quantity: params.quantity,
                    price: params.price,
                    stopPrice: params.stopPrice,
                    ...(params.stopLimitPrice !== undefined && { stopLimitPrice: params.stopLimitPrice }),
                    ...(params.stopLimitTimeInForce && { stopLimitTimeInForce: params.stopLimitTimeInForce }),
                    ...(params.listClientOrderId && { listClientOrderId: params.listClientOrderId }),
                    ...(params.limitClientOrderId && { limitClientOrderId: params.limitClientOrderId }),
                    ...(params.stopClientOrderId && { stopClientOrderId: params.stopClientOrderId }),
                    ...(params.limitIcebergQty !== undefined && { limitIcebergQty: params.limitIcebergQty }),
                    ...(params.stopIcebergQty !== undefined && { stopIcebergQty: params.stopIcebergQty }),
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
                        text: `Margin OCO order placed successfully: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to place margin OCO order: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
