/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/simple-earn/flexible/getFlexibleSubscriptionPreview.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { simpleEarnClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerSimpleEarnFlexibleSubscriptionPreview(server: McpServer) {
    server.tool(
        "BinanceSimpleEarnFlexibleSubscriptionPreview",
        "Preview a flexible product subscription before committing. Shows expected rewards and next interest date.",
        {
            productId: z.string().describe("Product ID to preview"),
            amount: z.number().positive().describe("Amount to preview subscription for"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await simpleEarnClient.restAPI.getFlexibleSubscriptionPreview({
                    productId: params.productId,
                    amount: params.amount,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `🔮 Subscription Preview\n\nProduct ID: ${params.productId}\nAmount: ${params.amount}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to preview subscription: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
