/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/auto-invest/createPlan.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerAutoInvestCreatePlan(server: McpServer) {
    server.tool(
        "BinanceAutoInvestCreatePlan",
        "Create an auto-invest plan for dollar-cost averaging. Automatically purchases crypto at regular intervals.",
        {
            sourceType: z.enum(["MAIN_SITE", "TR"]).describe("Source type"),
            planType: z.enum(["SINGLE", "PORTFOLIO", "INDEX"]).describe("Plan type"),
            subscriptionAmount: z.string().describe("Amount per subscription"),
            subscriptionCycle: z.enum(["H1", "H4", "H8", "H12", "WEEKLY", "DAILY", "MONTHLY", "BI_WEEKLY"])
                .describe("Subscription frequency"),
            subscriptionStartDay: z.number().int().optional()
                .describe("Start day (1-31 for MONTHLY, 1-7 for WEEKLY)"),
            subscriptionStartTime: z.number().int().min(0).max(23).describe("Start hour (0-23)"),
            sourceAsset: z.string().describe("Source asset (e.g., 'USDT')"),
            flexibleAllowedToUse: z.boolean().optional()
                .describe("Allow using flexible savings balance"),
            details: z.array(z.object({
                targetAsset: z.string().describe("Target asset to purchase"),
                percentage: z.number().describe("Percentage allocation (0-100)")
            })).describe("Target assets and allocation percentages"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.planAdd({
                    sourceType: params.sourceType,
                    planType: params.planType,
                    subscriptionAmount: params.subscriptionAmount,
                    subscriptionCycle: params.subscriptionCycle,
                    subscriptionStartTime: params.subscriptionStartTime,
                    sourceAsset: params.sourceAsset,
                    details: JSON.stringify(params.details),
                    ...(params.subscriptionStartDay && { subscriptionStartDay: params.subscriptionStartDay }),
                    ...(params.flexibleAllowedToUse !== undefined && { flexibleAllowedToUse: params.flexibleAllowedToUse }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Auto-invest plan created!\n\nPlan ID: ${data.planId}\nNext Execution: ${data.nextExecutionDateTime || 'Scheduled'}\n\nYour recurring investment plan is now active.`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to create auto-invest plan: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
