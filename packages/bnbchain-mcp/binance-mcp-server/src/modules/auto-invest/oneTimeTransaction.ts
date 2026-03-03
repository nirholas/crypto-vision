/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/auto-invest/oneTimeTransaction.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerAutoInvestOneTimeTransaction(server: McpServer) {
    server.tool(
        "BinanceAutoInvestOneTimeTransaction",
        "Execute a one-time auto-invest purchase. Instantly buy crypto using auto-invest infrastructure.",
        {
            sourceType: z.enum(["MAIN_SITE", "TR"]).describe("Source type"),
            subscriptionAmount: z.string().describe("Amount to invest"),
            sourceAsset: z.string().describe("Source asset (e.g., 'USDT')"),
            flexibleAllowedToUse: z.boolean().optional()
                .describe("Allow using flexible savings balance"),
            planId: z.number().int().optional().describe("Plan ID for plan-based one-time purchase"),
            indexId: z.number().int().optional().describe("Index ID for index-based purchase"),
            details: z.array(z.object({
                targetAsset: z.string().describe("Target asset to purchase"),
                percentage: z.number().describe("Percentage allocation (0-100)")
            })).optional().describe("Target assets and allocation (for non-plan purchases)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const requestParams: any = {
                    sourceType: params.sourceType,
                    subscriptionAmount: params.subscriptionAmount,
                    sourceAsset: params.sourceAsset,
                    ...(params.flexibleAllowedToUse !== undefined && { flexibleAllowedToUse: params.flexibleAllowedToUse }),
                    ...(params.planId && { planId: params.planId }),
                    ...(params.indexId && { indexId: params.indexId }),
                    ...(params.details && { details: JSON.stringify(params.details) }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                };
                
                const response = await autoInvestClient.restAPI.oneOff(requestParams);
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ One-time auto-invest purchase executed!\n\nTransaction ID: ${data.transactionId || data.tranId || 'Completed'}\nAmount: ${params.subscriptionAmount} ${params.sourceAsset}\n\nResponse: ${JSON.stringify(data)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to execute one-time purchase: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
