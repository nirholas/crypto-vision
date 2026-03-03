/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/auto-invest/changePlanStatus.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerAutoInvestChangePlanStatus(server: McpServer) {
    server.tool(
        "BinanceAutoInvestChangePlanStatus",
        "Change the status of an auto-invest plan (pause or resume).",
        {
            planId: z.number().int().describe("Plan ID to modify"),
            status: z.enum(["ONGOING", "PAUSED"]).describe("New status (ONGOING to resume, PAUSED to pause)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.planEditStatus({
                    planId: params.planId,
                    status: params.status,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                const statusText = params.status === "ONGOING" ? "resumed" : "paused";
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Auto-invest plan ${statusText}!\n\nPlan ID: ${params.planId}\nNew Status: ${params.status}\n\nResponse: ${JSON.stringify(data)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to change auto-invest plan status: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
