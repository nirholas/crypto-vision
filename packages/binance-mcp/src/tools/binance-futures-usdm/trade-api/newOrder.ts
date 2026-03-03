/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/trade-api/newOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesNewOrder(server: McpServer) {
    server.tool(
        "BinanceFuturesNewOrder",
        "Place a new USD-M Futures order. Supports LIMIT, MARKET, STOP, TAKE_PROFIT, and TRAILING_STOP_MARKET orders. ⚠️ RISK: Futures trading involves leverage and liquidation risk.",
        {
            symbol: z.string().describe("Futures symbol (e.g., BTCUSDT)"),
            side: z.enum(["BUY", "SELL"]).describe("Order side"),
            positionSide: z.enum(["BOTH", "LONG", "SHORT"]).optional().describe("Position side for Hedge Mode. Use BOTH for One-Way Mode"),
            type: z.enum([
                "LIMIT", "MARKET", "STOP", "STOP_MARKET", 
                "TAKE_PROFIT", "TAKE_PROFIT_MARKET", "TRAILING_STOP_MARKET"
            ]).describe("Order type"),
            quantity: z.string().optional().describe("Order quantity"),
            price: z.string().optional().describe("Limit price (required for LIMIT orders)"),
            stopPrice: z.string().optional().describe("Stop price (required for STOP orders)"),
            timeInForce: z.enum(["GTC", "IOC", "FOK", "GTX"]).optional().describe("Time in force. GTC=Good Till Cancel, IOC=Immediate Or Cancel, FOK=Fill Or Kill, GTX=Good Till Crossing"),
            reduceOnly: z.boolean().optional().describe("Reduce position only (cannot be used with closePosition)"),
            closePosition: z.boolean().optional().describe("Close entire position (cannot be used with quantity or reduceOnly)"),
            activationPrice: z.string().optional().describe("Activation price for TRAILING_STOP_MARKET"),
            callbackRate: z.string().optional().describe("Callback rate for TRAILING_STOP_MARKET (0.1% - 5%)"),
            workingType: z.enum(["MARK_PRICE", "CONTRACT_PRICE"]).optional().describe("Stop price trigger type"),
            priceProtect: z.boolean().optional().describe("Price protection"),
            newClientOrderId: z.string().optional().describe("Custom order ID"),
            newOrderRespType: z.enum(["ACK", "RESULT"]).optional().describe("Response type"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.newOrder({
                    symbol: params.symbol,
                    side: params.side,
                    type: params.type,
                    ...(params.positionSide && { positionSide: params.positionSide }),
                    ...(params.quantity && { quantity: params.quantity }),
                    ...(params.price && { price: params.price }),
                    ...(params.stopPrice && { stopPrice: params.stopPrice }),
                    ...(params.timeInForce && { timeInForce: params.timeInForce }),
                    ...(params.reduceOnly !== undefined && { reduceOnly: params.reduceOnly }),
                    ...(params.closePosition !== undefined && { closePosition: params.closePosition }),
                    ...(params.activationPrice && { activationPrice: params.activationPrice }),
                    ...(params.callbackRate && { callbackRate: params.callbackRate }),
                    ...(params.workingType && { workingType: params.workingType }),
                    ...(params.priceProtect !== undefined && { priceProtect: params.priceProtect }),
                    ...(params.newClientOrderId && { newClientOrderId: params.newClientOrderId }),
                    ...(params.newOrderRespType && { newOrderRespType: params.newOrderRespType }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Futures order placed successfully!\n\nOrder ID: ${data.orderId}\nClient Order ID: ${data.clientOrderId}\nSymbol: ${data.symbol}\nSide: ${data.side}\nPosition Side: ${data.positionSide || 'BOTH'}\nType: ${data.type}\nQuantity: ${data.origQty}\nPrice: ${data.price || 'MARKET'}\nStop Price: ${data.stopPrice || 'N/A'}\nStatus: ${data.status}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to place futures order: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
