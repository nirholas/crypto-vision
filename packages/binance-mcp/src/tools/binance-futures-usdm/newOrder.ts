// src/tools/binance-futures-usdm/newOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMNewOrder(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMNewOrder",
        "Create a new order for USD-M Futures.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            side: z.enum(["BUY", "SELL"]).describe("Order side"),
            type: z.enum(["LIMIT", "MARKET", "STOP", "STOP_MARKET", "TAKE_PROFIT", "TAKE_PROFIT_MARKET", "TRAILING_STOP_MARKET"]).describe("Order type"),
            positionSide: z.enum(["BOTH", "LONG", "SHORT"]).optional().describe("Position side. Default BOTH for One-way Mode; LONG or SHORT for Hedge Mode"),
            timeInForce: z.enum(["GTC", "IOC", "FOK", "GTX"]).optional().describe("Time in force"),
            quantity: z.number().optional().describe("Order quantity"),
            reduceOnly: z.boolean().optional().describe("Cannot be sent in Hedge Mode; cannot be sent with closePosition=true"),
            price: z.number().optional().describe("Order price"),
            newClientOrderId: z.string().optional().describe("Client order ID"),
            stopPrice: z.number().optional().describe("Stop price for STOP/STOP_MARKET/TAKE_PROFIT/TAKE_PROFIT_MARKET"),
            closePosition: z.boolean().optional().describe("Close all position. Used with STOP_MARKET or TAKE_PROFIT_MARKET"),
            activationPrice: z.number().optional().describe("Activation price for TRAILING_STOP_MARKET"),
            callbackRate: z.number().optional().describe("Callback rate for TRAILING_STOP_MARKET"),
            workingType: z.enum(["MARK_PRICE", "CONTRACT_PRICE"]).optional().describe("StopPrice triggered by MARK_PRICE or CONTRACT_PRICE"),
            priceProtect: z.boolean().optional().describe("Price protect"),
            newOrderRespType: z.enum(["ACK", "RESULT"]).optional().describe("Response type")
        },
        async (params) => {
            try {
                const requestParams: any = {
                    symbol: params.symbol,
                    side: params.side,
                    type: params.type
                };

                if (params.positionSide) requestParams.positionSide = params.positionSide;
                if (params.timeInForce) requestParams.timeInForce = params.timeInForce;
                if (params.quantity !== undefined) requestParams.quantity = params.quantity;
                if (params.reduceOnly !== undefined) requestParams.reduceOnly = params.reduceOnly;
                if (params.price !== undefined) requestParams.price = params.price;
                if (params.newClientOrderId) requestParams.newClientOrderId = params.newClientOrderId;
                if (params.stopPrice !== undefined) requestParams.stopPrice = params.stopPrice;
                if (params.closePosition !== undefined) requestParams.closePosition = params.closePosition;
                if (params.activationPrice !== undefined) requestParams.activationPrice = params.activationPrice;
                if (params.callbackRate !== undefined) requestParams.callbackRate = params.callbackRate;
                if (params.workingType) requestParams.workingType = params.workingType;
                if (params.priceProtect !== undefined) requestParams.priceProtect = params.priceProtect;
                if (params.newOrderRespType) requestParams.newOrderRespType = params.newOrderRespType;

                const data = await futuresClient.newOrder(requestParams);
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `USD-M Futures order created successfully. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to create USD-M Futures order: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
