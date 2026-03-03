/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/options/trade-api/newOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerOptionsNewOrder(server: McpServer) {
    server.tool(
        "BinanceOptionsNewOrder",
        "Place a new options order. Options trading allows you to buy/sell call and put contracts. ⚠️ HIGH RISK: Options can expire worthless.",
        {
            symbol: z.string().describe("Option symbol (e.g., 'BTC-240126-40000-C')"),
            side: z.enum(["BUY", "SELL"]).describe("Order side"),
            type: z.enum(["LIMIT"]).describe("Order type (only LIMIT supported)"),
            quantity: z.string().describe("Number of contracts"),
            price: z.string().describe("Limit price per contract"),
            timeInForce: z.enum(["GTC", "IOC", "FOK"]).optional()
                .describe("Time in force (default: GTC)"),
            reduceOnly: z.boolean().optional().describe("Reduce position only (default: false)"),
            postOnly: z.boolean().optional().describe("Post only order (default: false)"),
            newClientOrderId: z.string().optional().describe("Custom client order ID"),
            isMmp: z.boolean().optional().describe("Is market maker protection order"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await optionsClient.restAPI.newOrder({
                    symbol: params.symbol,
                    side: params.side,
                    type: params.type,
                    quantity: params.quantity,
                    price: params.price,
                    ...(params.timeInForce && { timeInForce: params.timeInForce }),
                    ...(params.reduceOnly !== undefined && { reduceOnly: params.reduceOnly }),
                    ...(params.postOnly !== undefined && { postOnly: params.postOnly }),
                    ...(params.newClientOrderId && { newClientOrderId: params.newClientOrderId }),
                    ...(params.isMmp !== undefined && { isMmp: params.isMmp }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Options order placed!\n\nOrder ID: ${data.orderId}\nSymbol: ${data.symbol}\nSide: ${data.side}\nType: ${data.type}\nQuantity: ${data.quantity}\nPrice: ${data.price}\nStatus: ${data.status}\nClient Order ID: ${data.clientOrderId || 'N/A'}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to place options order: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
