/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-auto-invest/getPlanList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceAutoInvestGetPlanList(server: McpServer) {
    server.tool(
        "BinanceAutoInvestGetPlanList",
        "Get list of all auto-invest plans for the user.",
        {
            planType: z.enum(["SINGLE", "PORTFOLIO", "INDEX", "ALL"]).optional().describe("Filter by plan type"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.getPlanList({
                    ...(params.planType && { planType: params.planType }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                const data = await response.data();
                
                const plans = data.planValueList || data.plans || data;
                const planCount = Array.isArray(plans) ? plans.length : 0;
                
                return {
                    content: [{
                        type: "text",
                        text: `Auto-invest plans (${planCount} total):\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get plan list: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
