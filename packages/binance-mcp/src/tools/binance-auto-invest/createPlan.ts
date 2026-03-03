// src/tools/binance-auto-invest/createPlan.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { autoInvestClient } from "../../config/binanceClient.js";

export function registerBinanceAutoInvestCreatePlan(server: McpServer) {
    server.tool(
        "BinanceAutoInvestCreatePlan",
        "Create an investment plan for auto-invest.",
        {
            sourceType: z.enum(["MAIN_SITE", "TR"]).describe("Source type"),
            planType: z.enum(["SINGLE", "PORTFOLIO", "INDEX"]).describe("Plan type"),
            subscriptionAmount: z.number().describe("Subscription amount"),
            subscriptionCycle: z.enum(["H1", "H4", "H8", "H12", "WEEKLY", "DAILY", "MONTHLY", "BI_WEEKLY"]).describe("Subscription cycle"),
            subscriptionStartTime: z.string().describe("Subscription start time"),
            sourceAsset: z.string().describe("Source asset (e.g., USDT)"),
            flexibleAllowedToUse: z.boolean().optional().describe("Whether flexible products are allowed to use"),
            details: z.string().describe("JSON array of plan details including targetAsset and percentage")
        },
        async ({ sourceType, planType, subscriptionAmount, subscriptionCycle, subscriptionStartTime, sourceAsset, flexibleAllowedToUse, details }) => {
            try {
                const params: any = {
                    sourceType,
                    planType,
                    subscriptionAmount,
                    subscriptionCycle,
                    subscriptionStartTime,
                    sourceAsset,
                    details
                };
                if (flexibleAllowedToUse !== undefined) params.flexibleAllowedToUse = flexibleAllowedToUse;
                
                const response = await autoInvestClient.restAPI.investmentPlanCreation(params);
                const data = await response.data();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Investment plan created successfully. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to create plan: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
