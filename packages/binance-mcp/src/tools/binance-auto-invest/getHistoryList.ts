/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-auto-invest/getHistoryList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceAutoInvestGetHistoryList(server: McpServer) {
    server.tool(
        "BinanceAutoInvestGetHistoryList",
        "Get auto-invest transaction history. View all past purchases and investments.",
        {
            planId: z.number().int().optional().describe("Filter by plan ID"),
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            targetAsset: z.string().optional().describe("Filter by target asset"),
            planType: z.enum(["SINGLE", "PORTFOLIO", "INDEX", "ALL"]).optional().describe("Filter by plan type"),
            size: z.number().int().max(100).optional().describe("Number of results. Default 10, max 100"),
            current: z.number().int().optional().describe("Current page. Default 1"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.getHistoryList({
                    ...(params.planId && { planId: params.planId }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.targetAsset && { targetAsset: params.targetAsset }),
                    ...(params.planType && { planType: params.planType }),
                    ...(params.size && { size: params.size }),
                    ...(params.current && { current: params.current }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `Auto-invest history:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
