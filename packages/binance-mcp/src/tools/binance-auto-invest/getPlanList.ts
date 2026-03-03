// src/tools/binance-auto-invest/getPlanList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { autoInvestClient } from "../../config/binanceClient.js";

export function registerBinanceAutoInvestGetPlanList(server: McpServer) {
    server.tool(
        "BinanceAutoInvestGetPlanList",
        "Query auto-invest plan list.",
        {
            planType: z.enum(["SINGLE", "PORTFOLIO", "INDEX"]).optional().describe("Plan type")
        },
        async ({ planType }) => {
            try {
                const params: any = {};
                if (planType) params.planType = planType;
                
                const response = await autoInvestClient.restAPI.getListOfPlans(params);
                const data = await response.data();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Plan list retrieved. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get plan list: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
