/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/trade-api/batchOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

const orderSchema = z.object({
    symbol: z.string(),
    side: z.enum(["BUY", "SELL"]),
    positionSide: z.enum(["BOTH", "LONG", "SHORT"]).optional(),
    type: z.enum([
        "LIMIT", "MARKET", "STOP", "STOP_MARKET", 
        "TAKE_PROFIT", "TAKE_PROFIT_MARKET", "TRAILING_STOP_MARKET"
    ]),
    quantity: z.string().optional(),
    price: z.string().optional(),
    stopPrice: z.string().optional(),
    timeInForce: z.enum(["GTC", "IOC", "FOK", "GTX"]).optional(),
    reduceOnly: z.boolean().optional(),
    workingType: z.enum(["MARK_PRICE", "CONTRACT_PRICE"]).optional(),
    priceProtect: z.boolean().optional(),
    newClientOrderId: z.string().optional()
});

export function registerBinanceFuturesBatchOrders(server: McpServer) {
    server.tool(
        "BinanceFuturesBatchOrders",
        "Place multiple USD-M Futures orders in a batch (max 5 orders). ⚠️ RISK: Futures trading involves leverage and liquidation risk.",
        {
            batchOrders: z.array(orderSchema).max(5).describe("Array of orders (max 5). Each order has: symbol, side, type, quantity, price, etc."),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.placeMultipleOrders({
                    batchOrders: JSON.stringify(params.batchOrders),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                const results = Array.isArray(data) ? data.map((order: any, index: number) => {
                    if (order.orderId) {
                        return `Order ${index + 1}: ✅ ${order.symbol} ${order.side} ${order.type} - ID: ${order.orderId}`;
                    } else {
                        return `Order ${index + 1}: ❌ Failed - ${order.msg || 'Unknown error'}`;
                    }
                }).join('\n') : 'Unexpected response format';
                
                return {
                    content: [{
                        type: "text",
                        text: `Batch Order Results:\n${results}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to place batch orders: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
