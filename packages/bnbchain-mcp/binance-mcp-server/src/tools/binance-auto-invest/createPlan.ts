/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-auto-invest/createPlan.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceAutoInvestCreatePlan(server: McpServer) {
    server.tool(
        "BinanceAutoInvestCreatePlan",
        "Create a new auto-invest plan for dollar-cost averaging (DCA). Automatically purchases crypto at regular intervals.",
        {
            sourceType: z.enum(["MAIN_SITE", "TR"]).describe("Source type"),
            planType: z.enum(["SINGLE", "PORTFOLIO", "INDEX"]).describe("Plan type: SINGLE for one asset, PORTFOLIO for multiple, INDEX for pre-built"),
            subscriptionAmount: z.string().describe("Amount per subscription in source asset"),
            subscriptionCycle: z.enum(["H1", "H4", "H8", "H12", "DAILY", "WEEKLY", "BI_WEEKLY", "MONTHLY"]).describe("Subscription frequency"),
            subscriptionStartTime: z.number().int().min(0).max(23).describe("Start hour (0-23 UTC)"),
            sourceAsset: z.string().describe("Source asset (e.g., 'USDT')"),
            subscriptionStartDay: z.number().int().optional().describe("Start day (1-31 for MONTHLY, 1-7 for WEEKLY where 1=Monday)"),
            subscriptionStartWeekday: z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]).optional().describe("Start weekday for WEEKLY/BI_WEEKLY"),
            flexibleAllowedToUse: z.boolean().optional().describe("Allow using Flexible Savings balance"),
            details: z.array(z.object({
                targetAsset: z.string().describe("Target asset to purchase (e.g., 'BTC')"),
                percentage: z.number().min(0).max(100).describe("Allocation percentage (all must sum to 100)")
            })).describe("Target assets and their allocation percentages"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.createPlan({
                    sourceType: params.sourceType,
                    planType: params.planType,
                    subscriptionAmount: params.subscriptionAmount,
                    subscriptionCycle: params.subscriptionCycle,
                    subscriptionStartTime: params.subscriptionStartTime,
                    sourceAsset: params.sourceAsset,
                    details: JSON.stringify(params.details),
                    ...(params.subscriptionStartDay && { subscriptionStartDay: params.subscriptionStartDay }),
                    ...(params.subscriptionStartWeekday && { subscriptionStartWeekday: params.subscriptionStartWeekday }),
                    ...(params.flexibleAllowedToUse !== undefined && { flexibleAllowedToUse: params.flexibleAllowedToUse }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Auto-invest plan created successfully!\n\nPlan ID: ${data.planId}\nNext Execution: ${data.nextExecutionDateTime || 'Scheduled'}\n\nDetails:\n${JSON.stringify(data, null, 2)}`
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
