/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-dual-investment/trade-api/subscribeDualInvestmentProducts.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dualInvestmentClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceSubscribeDualInvestmentProducts(server: McpServer) {
    server.tool(
        "BinanceSubscribeDualInvestmentProducts",
        "Subscribe to Dual Investment products by providing product ID, order ID, deposit amount, and auto compound plan to initiate investment with specified terms.",
        {
            id: z.string().describe("Product ID from /sapi/v1/dci/product/list"),
            orderId: z.string().describe("Order ID from /sapi/v1/dci/product/list"),
            depositAmount: z.number().positive().describe("The amount for subscribing"),
            autoCompoundPlan: z
                .enum(["NONE", "STANDARD", "ADVANCED"])
                .describe("Auto-compound plan: NONE (off), STANDARD, or ADVANCED"),
            recvWindow: z
                .number()
                .int()
                .max(60000, "recvWindow cannot be greater than 60000")
                .optional()
                .describe("Optional time window for request validity")
        },
        async (params) => {
            try {
                const response = await dualInvestmentClient.restAPI.subscribeDualInvestmentProducts({
                    id: params.id,
                    orderId: params.orderId,
                    depositAmount: params.depositAmount,
                    autoCompoundPlan: params.autoCompoundPlan,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully subscribed to Dual Investment products. Response: ${JSON.stringify(
                                data
                            )}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to subscribe to dual investment products: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
