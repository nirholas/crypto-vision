/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/auto-invest/getIndexLinkedPlanPositionDetails.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerAutoInvestGetIndexLinkedPlanPositionDetails(server: McpServer) {
    server.tool(
        "BinanceAutoInvestGetPlanDetails",
        "Get detailed information about a specific auto-invest plan including position details.",
        {
            planId: z.number().int().describe("Plan ID to query"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.planId({
                    planId: params.planId,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Auto-Invest Plan Details\n\n`;
                result += `Plan ID: ${params.planId}\n\n`;
                
                if (data) {
                    result += `**Plan Configuration**\n`;
                    result += `Type: ${data.planType || 'N/A'}\n`;
                    result += `Status: ${data.status || 'N/A'}\n`;
                    result += `Source Asset: ${data.sourceAsset || 'N/A'}\n`;
                    result += `Subscription Amount: ${data.subscriptionAmount || 'N/A'}\n`;
                    result += `Cycle: ${data.subscriptionCycle || 'N/A'}\n`;
                    result += `Next Execution: ${data.nextExecutionDateTime || 'N/A'}\n\n`;
                    
                    if (data.details && Array.isArray(data.details)) {
                        result += `**Position Details**\n`;
                        data.details.forEach((detail: any) => {
                            result += `**${detail.targetAsset}** (${detail.percentage}%)\n`;
                            result += `  Purchased Amount: ${detail.purchasedAmount || '0'}\n`;
                            result += `  Average Price: ${detail.avgPrice || 'N/A'}\n`;
                            result += `  Current Value: ${detail.currentValue || 'N/A'}\n`;
                            result += `  PnL: ${detail.pnl || 'N/A'}\n\n`;
                        });
                    }
                }
                
                return {
                    content: [{
                        type: "text",
                        text: result
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get auto-invest plan details: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
