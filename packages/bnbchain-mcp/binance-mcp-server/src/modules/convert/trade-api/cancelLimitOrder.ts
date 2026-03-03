/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-convert/trade-api/cancelLimitOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { convertClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceConvertCancelLimitOrder(server: McpServer) {
    server.tool(
        "BinanceConvertCancelLimitOrder",
        "Cancels a previously placed limit order using the orderId and returns the cancellation status along with the orderId.",
        {
            orderId: z.number().int().describe("The orderId from placeOrder API"),
            recvWindow: z
                .number()
                .int()
                .max(60000, "recvWindow cannot be greater than 60000")
                .optional()
                .describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await convertClient.restAPI.cancelLimitOrder({
                    orderId: params.orderId,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Canceled the placed limit order. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to placed limit order: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
