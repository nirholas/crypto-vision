/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/auto-invest/getPlanList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerAutoInvestGetPlanList(server: McpServer) {
    server.tool(
        "BinanceAutoInvestGetPlanList",
        "Get list of user's auto-invest plans. Shows all recurring investment plans.",
        {
            planType: z.enum(["SINGLE", "PORTFOLIO", "INDEX", "ALL"]).optional().describe("Plan type filter"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.planList({
                    ...(params.planType && { planType: params.planType }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Auto-Invest Plans\n\n`;
                
                const plans = data.planList || data.plans || data;
                
                if (Array.isArray(plans) && plans.length > 0) {
                    result += `Total plans: ${plans.length}\n\n`;
                    plans.forEach((plan: any, index: number) => {
                        result += `**${index + 1}. Plan ID: ${plan.planId}**\n`;
                        result += `  Type: ${plan.planType}\n`;
                        result += `  Status: ${plan.status}\n`;
                        result += `  Source Asset: ${plan.sourceAsset}\n`;
                        result += `  Subscription Amount: ${plan.subscriptionAmount}\n`;
                        result += `  Cycle: ${plan.subscriptionCycle}\n`;
                        result += `  Next Execution: ${plan.nextExecutionDateTime || 'N/A'}\n\n`;
                        
                        if (plan.details && Array.isArray(plan.details)) {
                            result += `  **Target Assets:**\n`;
                            plan.details.forEach((detail: any) => {
                                result += `    - ${detail.targetAsset}: ${detail.percentage}%\n`;
                            });
                            result += '\n';
                        }
                    });
                } else {
                    result += `No auto-invest plans found`;
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
                        text: `❌ Failed to get auto-invest plans: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
