// src/tools/binance-options/newOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsNewOrder(server: McpServer) {
    server.tool(
        "BinanceOptionsNewOrder",
        "Create a new options order.",
        {
            symbol: z.string().describe("Option trading symbol (e.g., BTC-240126-42000-C)"),
            side: z.enum(["BUY", "SELL"]).describe("Order side: BUY or SELL"),
            type: z.enum(["LIMIT", "MARKET"]).describe("Order type"),
            quantity: z.number().describe("Order quantity"),
            price: z.number().optional().describe("Order price (required for LIMIT orders)"),
            timeInForce: z.enum(["GTC", "IOC", "FOK"]).optional().describe("Time in force"),
            reduceOnly: z.boolean().optional().describe("Reduce only flag"),
            postOnly: z.boolean().optional().describe("Post only flag"),
            newOrderRespType: z.enum(["ACK", "RESULT"]).optional().describe("Response type"),
            clientOrderId: z.string().optional().describe("Client order ID")
        },
        async ({ symbol, side, type, quantity, price, timeInForce, reduceOnly, postOnly, newOrderRespType, clientOrderId }) => {
            try {
                const params: any = { symbol, side, type, quantity };
                if (price !== undefined) params.price = price;
                if (timeInForce) params.timeInForce = timeInForce;
                if (reduceOnly !== undefined) params.reduceOnly = reduceOnly;
                if (postOnly !== undefined) params.postOnly = postOnly;
                if (newOrderRespType) params.newOrderRespType = newOrderRespType;
                if (clientOrderId) params.clientOrderId = clientOrderId;
                
                const data = await optionsClient.newOrder(params);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Options order created successfully. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to create order: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
