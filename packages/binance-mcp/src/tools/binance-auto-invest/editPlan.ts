// src/tools/binance-auto-invest/editPlan.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { autoInvestClient } from "../../config/binanceClient.js";

export function registerBinanceAutoInvestEditPlan(server: McpServer) {
    server.tool(
        "BinanceAutoInvestEditPlan",
        "Edit an existing investment plan for auto-invest.",
        {
            planId: z.number().describe("Plan ID to edit"),
            subscriptionAmount: z.number().optional().describe("Subscription amount"),
            subscriptionCycle: z.enum(["H1", "H4", "H8", "H12", "WEEKLY", "DAILY", "MONTHLY", "BI_WEEKLY"]).optional().describe("Subscription cycle"),
            subscriptionStartTime: z.string().optional().describe("Subscription start time"),
            sourceAsset: z.string().optional().describe("Source asset (e.g., USDT)"),
            flexibleAllowedToUse: z.boolean().optional().describe("Whether flexible products are allowed to use"),
            details: z.string().optional().describe("JSON array of plan details including targetAsset and percentage")
        },
        async ({ planId, subscriptionAmount, subscriptionCycle, subscriptionStartTime, sourceAsset, flexibleAllowedToUse, details }) => {
            try {
                const params: any = { planId };
                if (subscriptionAmount !== undefined) params.subscriptionAmount = subscriptionAmount;
                if (subscriptionCycle) params.subscriptionCycle = subscriptionCycle;
                if (subscriptionStartTime) params.subscriptionStartTime = subscriptionStartTime;
                if (sourceAsset) params.sourceAsset = sourceAsset;
                if (flexibleAllowedToUse !== undefined) params.flexibleAllowedToUse = flexibleAllowedToUse;
                if (details) params.details = details;
                
                const response = await autoInvestClient.restAPI.investmentPlanAdjustment(params);
                const data = await response.data();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Investment plan edited successfully. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to edit plan: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
