// src/tools/binance-futures-coinm/newOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesCOINMNewOrder(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMNewOrder",
        "Send a new COIN-M futures order.",
        {
            symbol: z.string().describe("Trading symbol (e.g., BTCUSD_PERP)"),
            side: z.enum(["BUY", "SELL"]).describe("Order side"),
            type: z.enum(["LIMIT", "MARKET", "STOP", "STOP_MARKET", "TAKE_PROFIT", "TAKE_PROFIT_MARKET", "TRAILING_STOP_MARKET"]).describe("Order type"),
            positionSide: z.enum(["BOTH", "LONG", "SHORT"]).optional().describe("Position side for hedge mode"),
            quantity: z.number().optional().describe("Order quantity"),
            price: z.number().optional().describe("Order price (required for LIMIT orders)"),
            stopPrice: z.number().optional().describe("Stop price for stop orders"),
            timeInForce: z.enum(["GTC", "IOC", "FOK", "GTX"]).optional().describe("Time in force"),
            reduceOnly: z.boolean().optional().describe("Reduce only order"),
            newClientOrderId: z.string().optional().describe("Client order ID"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await deliveryClient.newOrder({
                    symbol: params.symbol,
                    side: params.side,
                    type: params.type,
                    ...(params.positionSide && { positionSide: params.positionSide }),
                    ...(params.quantity && { quantity: params.quantity }),
                    ...(params.price && { price: params.price }),
                    ...(params.stopPrice && { stopPrice: params.stopPrice }),
                    ...(params.timeInForce && { timeInForce: params.timeInForce }),
                    ...(params.reduceOnly !== undefined && { reduceOnly: params.reduceOnly }),
                    ...(params.newClientOrderId && { newClientOrderId: params.newClientOrderId }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                return {
                    content: [{ type: "text", text: `COIN-M order placed: ${JSON.stringify(data)}` }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to place COIN-M order: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
