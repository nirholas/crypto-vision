// src/tools/binance-auto-invest/getSubscriptionHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { autoInvestClient } from "../../config/binanceClient.js";

export function registerBinanceAutoInvestGetSubscriptionHistory(server: McpServer) {
    server.tool(
        "BinanceAutoInvestGetSubscriptionHistory",
        "Query subscription transaction history for auto-invest.",
        {
            planId: z.number().optional().describe("Plan ID"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            targetAsset: z.string().optional().describe("Target asset (e.g., BTC)"),
            planType: z.enum(["SINGLE", "PORTFOLIO", "INDEX"]).optional().describe("Plan type"),
            current: z.number().optional().describe("Current page"),
            size: z.number().optional().describe("Page size")
        },
        async ({ planId, startTime, endTime, targetAsset, planType, current, size }) => {
            try {
                const params: any = {};
                if (planId !== undefined) params.planId = planId;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (targetAsset) params.targetAsset = targetAsset;
                if (planType) params.planType = planType;
                if (current !== undefined) params.current = current;
                if (size !== undefined) params.size = size;
                
                const response = await autoInvestClient.restAPI.querySubscriptionTransactionHistory(params);
                const data = await response.data();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Subscription history retrieved. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get subscription history: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
