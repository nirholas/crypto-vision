/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-auto-invest/rebalanceHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceAutoInvestRebalanceHistory(server: McpServer) {
    server.tool(
        "BinanceAutoInvestRebalanceHistory",
        "Get rebalance history for portfolio/index plans. Shows when and how allocations were rebalanced.",
        {
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            size: z.number().int().max(100).optional().describe("Number of results. Default 10, max 100"),
            current: z.number().int().optional().describe("Current page. Default 1"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.getRebalanceHistory({
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.size && { size: params.size }),
                    ...(params.current && { current: params.current }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `Rebalance history:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get rebalance history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
