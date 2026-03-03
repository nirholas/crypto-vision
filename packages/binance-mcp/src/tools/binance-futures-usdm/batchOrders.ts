// src/tools/binance-futures-usdm/batchOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMBatchOrders(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMBatchOrders",
        "Place multiple orders for USD-M Futures (max 5 orders).",
        {
            batchOrders: z.string().describe("JSON string of order list. Max 5 orders. Each order has: symbol, side, type, and optional parameters like positionSide, timeInForce, quantity, reduceOnly, price, newClientOrderId, stopPrice, activationPrice, callbackRate, workingType, priceProtect")
        },
        async ({ batchOrders }) => {
            try {
                const data = await futuresClient.batchOrders({ batchOrders });

                return {
                    content: [
                        {
                            type: "text",
                            text: `USD-M Futures batch orders created. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to create USD-M Futures batch orders: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
