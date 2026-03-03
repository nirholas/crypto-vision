/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/simple-earn/flexible/subscribeFlexible.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { simpleEarnClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerSimpleEarnSubscribeFlexible(server: McpServer) {
    server.tool(
        "BinanceSimpleEarnFlexibleSubscribe",
        "Subscribe to a Simple Earn Flexible product to earn daily rewards. Funds can be redeemed anytime. 💰 Start earning passive income on your crypto!",
        {
            productId: z.string().describe("Product ID from flexible product list"),
            amount: z.number().positive().describe("Amount to subscribe"),
            autoSubscribe: z.boolean().optional().describe("Auto-subscribe on redemption (default: true)"),
            sourceAccount: z.enum(["SPOT", "FUND", "ALL"]).optional()
                .describe("Source account for funds (default: SPOT)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
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
                    content: [{
                        type: "text",
                        text: `✅ Flexible Product Subscription Successful!\n\nProduct ID: ${params.productId}\nAmount: ${params.amount}\nPurchase ID: ${data.purchaseId || 'N/A'}\n\n💡 Your funds will start earning rewards within 24 hours.`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to subscribe to flexible product: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
