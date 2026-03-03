// src/tools/binance-auto-invest/redeemIndexLinkedPlan.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { autoInvestClient } from "../../config/binanceClient.js";

export function registerBinanceAutoInvestRedeemIndexLinkedPlan(server: McpServer) {
    server.tool(
        "BinanceAutoInvestRedeemIndexLinkedPlan",
        "Redeem index linked plan for auto-invest.",
        {
            indexId: z.number().describe("Index ID"),
            redemptionPercentage: z.number().describe("Redemption percentage (0-100)"),
            requestId: z.string().optional().describe("Request ID for idempotency")
        },
        async ({ indexId, redemptionPercentage, requestId }) => {
            try {
                const params: any = { indexId, redemptionPercentage };
                if (requestId) params.requestId = requestId;
                
                const response = await autoInvestClient.restAPI.indexLinkedPlanRedemption(params);
                const data = await response.data();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Index linked plan redeemed successfully. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to redeem index linked plan: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
