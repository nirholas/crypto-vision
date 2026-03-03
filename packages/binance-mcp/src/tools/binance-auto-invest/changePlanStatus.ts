// src/tools/binance-auto-invest/changePlanStatus.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { autoInvestClient } from "../../config/binanceClient.js";

export function registerBinanceAutoInvestChangePlanStatus(server: McpServer) {
    server.tool(
        "BinanceAutoInvestChangePlanStatus",
        "Change plan status (pause/resume) for auto-invest.",
        {
            planId: z.number().describe("Plan ID"),
            status: z.enum(["ONGOING", "PAUSED", "REMOVED"]).describe("New plan status")
        },
        async ({ planId, status }) => {
            try {
                const params: any = { planId, status };
                
                const response = await autoInvestClient.restAPI.changePlanStatus(params);
                const data = await response.data();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Plan status changed successfully. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to change plan status: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
