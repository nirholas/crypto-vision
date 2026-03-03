/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-spot/trade-api/orderOco.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spotClient } from "../../../config/binanceClient.js";

export function registerBinanceOrderOco(server: McpServer) {
    server.tool(
        "BinanceOrderOco",
        "Send a new OCO (One-Cancels-the-Other) order on Binance.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            side: z.enum(["BUY", "SELL"]).describe("Order side: BUY or SELL"),
            quantity: z.number().describe("Order quantity"),
            price: z.number().describe("Order price"),
            stopPrice: z.number().describe("Stop price"),
            stopLimitPrice: z.number().optional().describe("Stop limit price"),
            stopLimitTimeInForce: z.enum(["GTC", "IOC", "FOK"]).optional().describe("Stop limit time in force"),
            newClientOrderId: z.string().optional().describe("Client order ID for the limit order"),
            stopClientOrderId: z.string().optional().describe("Client order ID for the stop order"),
            limitIcebergQty: z.number().optional().describe("Limit iceberg quantity"),
            stopIcebergQty: z.number().optional().describe("Stop iceberg quantity")
        },
        async ({ symbol, side, quantity, price, stopPrice, stopLimitPrice, stopLimitTimeInForce, newClientOrderId, stopClientOrderId, limitIcebergQty, stopIcebergQty }) => {
            try {
                const params: any = { 
                    symbol,
                    side,
                    quantity,
                    price,
                    stopPrice
                };
                
                if (stopLimitPrice !== undefined) params.stopLimitPrice = stopLimitPrice;
                if (stopLimitTimeInForce) params.stopLimitTimeInForce = stopLimitTimeInForce;
                if (newClientOrderId) params.newClientOrderId = newClientOrderId;
                if (stopClientOrderId) params.stopClientOrderId = stopClientOrderId;
                if (limitIcebergQty !== undefined) params.limitIcebergQty = limitIcebergQty;
                if (stopIcebergQty !== undefined) params.stopIcebergQty = stopIcebergQty;
                
                const response = await spotClient.restAPI.orderOco(params);

                const data = await response.data();
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `OCO order successfully created. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to create OCO order: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}