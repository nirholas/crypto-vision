/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/simple-earn/flexible/redeemFlexible.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { simpleEarnClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerSimpleEarnRedeemFlexible(server: McpServer) {
    server.tool(
        "BinanceSimpleEarnFlexibleRedeem",
        "Redeem from a Simple Earn Flexible product. Funds are returned to your spot wallet. 💸 Instant redemption available!",
        {
            productId: z.string().describe("Product ID to redeem from"),
            redeemAll: z.boolean().optional().describe("Redeem all position (true/false)"),
            amount: z.number().positive().optional().describe("Amount to redeem (required if redeemAll is false)"),
            destAccount: z.enum(["SPOT", "FUND"]).optional().describe("Destination account (default: SPOT)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await simpleEarnClient.restAPI.redeemFlexibleProduct({
                    productId: params.productId,
                    ...(params.redeemAll !== undefined && { redeemAll: params.redeemAll }),
                    ...(params.amount && { amount: params.amount }),
                    ...(params.destAccount && { destAccount: params.destAccount }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `✅ Flexible Product Redemption Successful!\n\nProduct ID: ${params.productId}\nAmount: ${params.redeemAll ? 'All' : params.amount}\nRedemption ID: ${data.redeemId || 'N/A'}\n\n💡 Funds will be credited to your ${params.destAccount || 'SPOT'} account shortly.`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to redeem flexible product: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
