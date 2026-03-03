// src/tools/binance-simple-earn/earn-api/subscribeFlexibleProduct.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { simpleEarnClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceSubscribeFlexibleProduct(server: McpServer) {
    server.tool(
        "BinanceSubscribeFlexibleProduct",
        "Subscribe to a Simple Earn Flexible Product by specifying the product ID and amount. Optional parameters include auto-subscribe and source account. ",
        {
            productId: z.string().describe("Product ID"),
            amount: z.number().positive().describe("Amount to purchase"),
            autoSubscribe: z.boolean().optional().describe("true or false, default is true"),
            sourceAccount: z
                .enum(["SPOT", "FUND", "ALL"])
                .optional()
                .describe("Source account: SPOT, FUND, or ALL; default is SPOT"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await simpleEarnClient.restAPI.subscribeFlexibleProduct({
                    productId: params.productId,
                    amount: params.amount,
                    ...(params.autoSubscribe !== undefined && { autoSubscribe: params.autoSubscribe }),
                    ...(params.sourceAccount && { sourceAccount: params.sourceAccount }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully Subscribed to Simple Earn Flexible Product id ${
                                params.productId
                            } and amount${params.amount}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to subscribe to a Simple Earn Flexible Product: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
