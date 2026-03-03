/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-auto-invest/changePlanStatus.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceAutoInvestChangePlanStatus(server: McpServer) {
    server.tool(
        "BinanceAutoInvestChangePlanStatus",
        "Change the status of an auto-invest plan (pause/resume/remove).",
        {
            planId: z.number().int().describe("Plan ID to modify"),
            status: z.enum(["ONGOING", "PAUSED", "REMOVED"]).describe("New plan status: ONGOING to resume, PAUSED to pause, REMOVED to delete"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.changePlanStatus({
                    planId: params.planId,
                    status: params.status,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                const statusMessage = params.status === "ONGOING" ? "resumed" : 
                                     params.status === "PAUSED" ? "paused" : "removed";
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Auto-invest plan ${params.planId} ${statusMessage}!\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to change plan status: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
