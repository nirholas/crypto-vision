/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/trade-api/newOrder.ts// src/tools/binance-futures-coinm/trade-api/newOrder.ts







































































}    );        }            }                };                    isError: true                    content: [{ type: "text", text: `❌ Failed to place order: ${errorMessage}` }],                return {                const errorMessage = error instanceof Error ? error.message : String(error);            } catch (error) {                };                    }]                        text: `✅ COIN-M order placed successfully!\n\nOrder ID: ${data.orderId}\nSymbol: ${data.symbol}\nSide: ${data.side}\nType: ${data.type}\nQuantity: ${data.origQty}\nStatus: ${data.status}\n\n${JSON.stringify(data, null, 2)}`                        type: "text",                    content: [{                return {                                const data = await response.data();                                });                    ...(params.recvWindow && { recvWindow: params.recvWindow })                    ...(params.newOrderRespType && { newOrderRespType: params.newOrderRespType }),                    ...(params.newClientOrderId && { newClientOrderId: params.newClientOrderId }),                    ...(params.priceProtect !== undefined && { priceProtect: params.priceProtect }),                    ...(params.workingType && { workingType: params.workingType }),                    ...(params.callbackRate && { callbackRate: params.callbackRate }),                    ...(params.activationPrice && { activationPrice: params.activationPrice }),                    ...(params.closePosition !== undefined && { closePosition: params.closePosition }),                    ...(params.reduceOnly !== undefined && { reduceOnly: params.reduceOnly }),                    ...(params.timeInForce && { timeInForce: params.timeInForce }),                    ...(params.stopPrice && { stopPrice: params.stopPrice }),                    ...(params.price && { price: params.price }),                    ...(params.quantity && { quantity: params.quantity }),                    ...(params.positionSide && { positionSide: params.positionSide }),                    type: params.type,                    side: params.side,                    symbol: params.symbol,                const response = await deliveryClient.restAPI.newOrder({            try {        async (params) => {        },            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")            newOrderRespType: z.enum(["ACK", "RESULT"]).optional().describe("Response type"),            newClientOrderId: z.string().optional().describe("Custom order ID"),            priceProtect: z.boolean().optional().describe("Price protection"),            workingType: z.enum(["MARK_PRICE", "CONTRACT_PRICE"]).optional().describe("Stop trigger type"),            callbackRate: z.string().optional().describe("Callback rate for TRAILING_STOP_MARKET"),            activationPrice: z.string().optional().describe("Activation price for TRAILING_STOP_MARKET"),            closePosition: z.boolean().optional().describe("Close entire position"),            reduceOnly: z.boolean().optional().describe("Reduce position only"),            timeInForce: z.enum(["GTC", "IOC", "FOK", "GTX"]).optional().describe("Time in force"),            stopPrice: z.string().optional().describe("Stop price for STOP/TAKE_PROFIT orders"),            price: z.string().optional().describe("Limit price (required for LIMIT orders)"),            quantity: z.string().optional().describe("Order quantity in contracts"),            ]).describe("Order type"),                "TAKE_PROFIT", "TAKE_PROFIT_MARKET", "TRAILING_STOP_MARKET"                "LIMIT", "MARKET", "STOP", "STOP_MARKET",             type: z.enum([            positionSide: z.enum(["BOTH", "LONG", "SHORT"]).optional().describe("Position side for Hedge Mode"),            side: z.enum(["BUY", "SELL"]).describe("Order side"),            symbol: z.string().describe("Contract symbol (e.g., BTCUSD_PERP)"),        {        "Place a new COIN-M Futures order. ⚠️ RISK: Futures trading involves leverage and liquidation risk.",        "BinanceDeliveryNewOrder",    server.tool(export function registerBinanceDeliveryNewOrder(server: McpServer) {import { z } from "zod";import { deliveryClient } from "../../../config/binanceClient.js";import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryNewOrder(server: McpServer) {
    server.tool(
        "BinanceDeliveryNewOrder",
        "Place a new COIN-M Futures (Delivery) order. COIN-M futures are settled in the coin itself (e.g., BTC). ⚠️ RISK: Futures trading involves leverage and liquidation risk.",
        {
            symbol: z.string().describe("Delivery futures symbol (e.g., BTCUSD_PERP, BTCUSD_240329)"),
            side: z.enum(["BUY", "SELL"]).describe("Order side"),
            positionSide: z.enum(["BOTH", "LONG", "SHORT"]).optional().describe("Position side for Hedge Mode. Use BOTH for One-Way Mode"),
            type: z.enum([
                "LIMIT", "MARKET", "STOP", "STOP_MARKET", 
                "TAKE_PROFIT", "TAKE_PROFIT_MARKET", "TRAILING_STOP_MARKET"
            ]).describe("Order type"),
            quantity: z.string().optional().describe("Order quantity in contracts"),
            price: z.string().optional().describe("Limit price (required for LIMIT orders)"),
            stopPrice: z.string().optional().describe("Stop price (required for STOP orders)"),
            timeInForce: z.enum(["GTC", "IOC", "FOK", "GTX"]).optional().describe("Time in force"),
            reduceOnly: z.boolean().optional().describe("Reduce position only"),
            closePosition: z.boolean().optional().describe("Close entire position"),
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
                const response = await deliveryClient.restAPI.newOrder({
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
                        text: `✅ COIN-M Futures order placed!\n\nOrder ID: ${data.orderId}\nSymbol: ${data.symbol}\nSide: ${data.side}\nType: ${data.type}\nQuantity: ${data.origQty}\nPrice: ${data.price || 'MARKET'}\nStatus: ${data.status}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to place COIN-M order: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
