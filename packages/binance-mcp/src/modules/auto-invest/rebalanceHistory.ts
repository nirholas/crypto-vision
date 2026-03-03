/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/auto-invest/rebalanceHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerAutoInvestRebalanceHistory(server: McpServer) {
    server.tool(
        "BinanceAutoInvestRebalanceHistory",
        "Get auto-invest portfolio rebalance history. Shows past rebalancing transactions.",
        {
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            size: z.number().int().min(1).max(100).optional().describe("Number of results (default 10, max 100)"),
            current: z.number().int().min(1).optional().describe("Page number (default 1)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.rebalanceHistory({
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.size && { size: params.size }),
                    ...(params.current && { current: params.current }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Auto-Invest Rebalance History\n\n`;
                
                const history = data.list || data.data || data;
                
                if (Array.isArray(history) && history.length > 0) {
                    result += `Total rebalances: ${data.total || history.length}\n\n`;
                    history.forEach((rebalance: any, index: number) => {
                        result += `**${index + 1}. Rebalance ID: ${rebalance.id || rebalance.rebalanceId}**\n`;
                        result += `  Status: ${rebalance.status}\n`;
                        result += `  Time: ${rebalance.rebalanceDateTime || new Date(rebalance.time).toISOString()}\n`;
                        if (rebalance.details) {
                            result += `  Details: ${JSON.stringify(rebalance.details)}\n`;
                        }
                        result += '\n';
                    });
                } else {
                    result += `No rebalance history found`;
                }
                
                return {
                    content: [{
                        type: "text",
                        text: result
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get rebalance history: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
