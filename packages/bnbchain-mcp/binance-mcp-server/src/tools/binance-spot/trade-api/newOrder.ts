/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-spot/trade-api/newOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spotClient } from "../../../config/binanceClient.js";

export function registerBinanceNewOrder(server: McpServer) {
    server.tool(
        "BinanceNewOrder",
        "Create a new order on Binance for a specific trading pair.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            side: z.enum(["BUY", "SELL"]).describe("Order side: BUY or SELL"),
            type: z.enum(["LIMIT", "MARKET", "STOP_LOSS", "STOP_LOSS_LIMIT", "TAKE_PROFIT", "TAKE_PROFIT_LIMIT", "LIMIT_MAKER"]).describe("Order type"),
            timeInForce: z.enum(["GTC", "IOC", "FOK"]).optional().describe("Time in force"),
            quantity: z.number().describe("Order quantity"),
            quoteOrderQty: z.number().optional().describe("Quote order quantity"),
            price: z.number().optional().describe("Order price"),
            newClientOrderId: z.string().optional().describe("Client order ID"),
            stopPrice: z.number().optional().describe("Stop price"),
            icebergQty: z.number().optional().describe("Iceberg quantity"),
            newOrderRespType: z.enum(["ACK", "RESULT", "FULL"]).optional().describe("Response type")
        },
        async ({ symbol, side, type, timeInForce, quantity, quoteOrderQty, price, newClientOrderId, stopPrice, icebergQty, newOrderRespType }) => {
            try {
                const params: any = { 
                    symbol,
                    side,
                    type,
                    quantity
                };
                
                if (timeInForce) params.timeInForce = timeInForce;
                if (quoteOrderQty !== undefined) params.quoteOrderQty = quoteOrderQty;
                if (price !== undefined) params.price = price;
                if (newClientOrderId) params.newClientOrderId = newClientOrderId;
                if (stopPrice !== undefined) params.stopPrice = stopPrice;
                if (icebergQty !== undefined) params.icebergQty = icebergQty;
                if (newOrderRespType) params.newOrderRespType = newOrderRespType;
                
                const response = await spotClient.restAPI.newOrder(params);

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `New order successfully created. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to create new order: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}