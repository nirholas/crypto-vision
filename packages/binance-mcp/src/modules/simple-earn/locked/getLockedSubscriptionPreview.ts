/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/simple-earn/locked/getLockedSubscriptionPreview.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { simpleEarnClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerSimpleEarnLockedSubscriptionPreview(server: McpServer) {
    server.tool(
        "BinanceSimpleEarnLockedSubscriptionPreview",
        "Preview a locked product subscription before committing. Shows expected rewards, lock duration, and maturity date.",
        {
            projectId: z.string().describe("Project ID to preview"),
            amount: z.number().positive().describe("Amount to preview subscription for"),
            autoSubscribe: z.boolean().optional().describe("Include auto-subscribe in preview"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await simpleEarnClient.restAPI.getLockedSubscriptionPreview({
                    projectId: params.projectId,
                    amount: params.amount,
                    ...(params.autoSubscribe !== undefined && { autoSubscribe: params.autoSubscribe }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `🔮 Locked Subscription Preview\n\nProject ID: ${params.projectId}\nAmount: ${params.amount}\n\n${JSON.stringify(data, null, 2)}`
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
