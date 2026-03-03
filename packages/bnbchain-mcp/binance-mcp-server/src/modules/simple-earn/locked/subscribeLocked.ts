/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/simple-earn/locked/subscribeLocked.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { simpleEarnClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerSimpleEarnSubscribeLocked(server: McpServer) {
    server.tool(
        "BinanceSimpleEarnLockedSubscribe",
        "Subscribe to a Simple Earn Locked product. ⚠️ Funds will be locked for the specified duration. Higher APR than flexible products!",
        {
            projectId: z.string().describe("Locked product project ID"),
            amount: z.number().positive().describe("Amount to subscribe"),
            autoSubscribe: z.boolean().optional().describe("Auto-resubscribe when position matures"),
            sourceAccount: z.enum(["SPOT", "FUND", "ALL"]).optional()
                .describe("Source account for funds (default: SPOT)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await simpleEarnClient.restAPI.subscribeLockedProduct({
                    projectId: params.projectId,
                    amount: params.amount,
                    ...(params.autoSubscribe !== undefined && { autoSubscribe: params.autoSubscribe }),
                    ...(params.sourceAccount && { sourceAccount: params.sourceAccount }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `✅ Locked Product Subscription Successful!\n\nProject ID: ${params.projectId}\nAmount: ${params.amount}\nPosition ID: ${data.positionId || 'N/A'}\n\n⚠️ Your funds are now locked. Rewards will be distributed based on the product terms.`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to subscribe to locked product: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
