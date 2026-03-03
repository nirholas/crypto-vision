/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-auto-invest/oneTimeTransaction.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceAutoInvestOneTimeTransaction(server: McpServer) {
    server.tool(
        "BinanceAutoInvestOneTimeTransaction",
        "Execute a one-time auto-invest purchase. Buy crypto instantly without creating a recurring plan.",
        {
            sourceType: z.enum(["MAIN_SITE", "TR"]).describe("Source type"),
            subscriptionAmount: z.string().describe("Amount to invest in source asset"),
            sourceAsset: z.string().describe("Source asset (e.g., 'USDT')"),
            flexibleAllowedToUse: z.boolean().optional().describe("Allow using Flexible Savings balance"),
            planId: z.number().int().optional().describe("Plan ID if investing in existing plan"),
            indexId: z.number().int().optional().describe("Index ID for index portfolio"),
            details: z.array(z.object({
                targetAsset: z.string().describe("Target asset to purchase"),
                percentage: z.number().min(0).max(100).describe("Allocation percentage")
            })).optional().describe("Target assets and allocations (for ad-hoc purchase)"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.oneTimeTransaction({
                    sourceType: params.sourceType,
                    subscriptionAmount: params.subscriptionAmount,
                    sourceAsset: params.sourceAsset,
                    ...(params.flexibleAllowedToUse !== undefined && { flexibleAllowedToUse: params.flexibleAllowedToUse }),
                    ...(params.planId && { planId: params.planId }),
                    ...(params.indexId && { indexId: params.indexId }),
                    ...(params.details && { details: JSON.stringify(params.details) }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ One-time investment executed!\n\nTransaction ID: ${data.transactionId || 'N/A'}\nAmount: ${params.subscriptionAmount} ${params.sourceAsset}\n\nDetails:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to execute one-time transaction: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
