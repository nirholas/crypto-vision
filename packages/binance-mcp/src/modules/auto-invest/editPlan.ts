/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/auto-invest/editPlan.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerAutoInvestEditPlan(server: McpServer) {
    server.tool(
        "BinanceAutoInvestEditPlan",
        "Edit an existing auto-invest plan. Modify subscription amount, cycle, or target allocations.",
        {
            planId: z.number().int().describe("Plan ID to edit"),
            subscriptionAmount: z.string().describe("New amount per subscription"),
            subscriptionCycle: z.enum(["H1", "H4", "H8", "H12", "WEEKLY", "DAILY", "MONTHLY", "BI_WEEKLY"])
                .describe("New subscription frequency"),
            subscriptionStartDay: z.number().int().optional()
                .describe("New start day (1-31 for MONTHLY, 1-7 for WEEKLY)"),
            subscriptionStartTime: z.number().int().min(0).max(23).describe("New start hour (0-23)"),
            sourceAsset: z.string().describe("Source asset (e.g., 'USDT')"),
            flexibleAllowedToUse: z.boolean().optional()
                .describe("Allow using flexible savings balance"),
            details: z.array(z.object({
                targetAsset: z.string().describe("Target asset to purchase"),
                percentage: z.number().describe("Percentage allocation (0-100)")
            })).describe("New target assets and allocation percentages"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.planEdit({
                    planId: params.planId,
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
                        text: `✅ Auto-invest plan updated!\n\nPlan ID: ${params.planId}\nNext Execution: ${data.nextExecutionDateTime || 'Scheduled'}\n\nYour plan has been modified.`
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
