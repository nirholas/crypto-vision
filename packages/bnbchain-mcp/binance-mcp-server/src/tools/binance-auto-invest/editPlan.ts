/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-auto-invest/editPlan.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceAutoInvestEditPlan(server: McpServer) {
    server.tool(
        "BinanceAutoInvestEditPlan",
        "Edit an existing auto-invest plan. Modify subscription amount, frequency, or target allocations.",
        {
            planId: z.number().int().describe("Plan ID to edit"),
            subscriptionAmount: z.string().describe("New amount per subscription"),
            subscriptionCycle: z.enum(["H1", "H4", "H8", "H12", "DAILY", "WEEKLY", "BI_WEEKLY", "MONTHLY"]).describe("New subscription frequency"),
            subscriptionStartTime: z.number().int().min(0).max(23).describe("New start hour (0-23 UTC)"),
            sourceAsset: z.string().describe("Source asset (e.g., 'USDT')"),
            subscriptionStartDay: z.number().int().optional().describe("Start day (1-31 for MONTHLY)"),
            subscriptionStartWeekday: z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]).optional().describe("Start weekday for WEEKLY/BI_WEEKLY"),
            flexibleAllowedToUse: z.boolean().optional().describe("Allow using Flexible Savings balance"),
            details: z.array(z.object({
                targetAsset: z.string().describe("Target asset"),
                percentage: z.number().min(0).max(100).describe("Allocation percentage")
            })).describe("New target assets and allocations"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.editPlan({
                    planId: params.planId,
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
                        text: `✅ Auto-invest plan ${params.planId} updated successfully!\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to edit auto-invest plan: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
