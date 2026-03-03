/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/auto-invest/getHistoryList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerAutoInvestGetHistoryList(server: McpServer) {
    server.tool(
        "BinanceAutoInvestGetHistoryList",
        "Get auto-invest transaction history. Shows all past recurring purchases.",
        {
            planId: z.number().int().optional().describe("Filter by plan ID"),
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            targetAsset: z.string().optional().describe("Filter by target asset"),
            planType: z.enum(["SINGLE", "PORTFOLIO", "INDEX", "ALL"]).optional().describe("Plan type filter"),
            size: z.number().int().min(1).max(100).optional().describe("Number of results (default 10, max 100)"),
            current: z.number().int().min(1).optional().describe("Page number (default 1)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.historyList({
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
                
                let result = `✅ Auto-Invest Transaction History\n\n`;
                
                const history = data.list || data.data || data;
                
                if (Array.isArray(history) && history.length > 0) {
                    result += `Total transactions: ${data.total || history.length}\n\n`;
                    history.slice(0, 20).forEach((tx: any, index: number) => {
                        result += `**${index + 1}. Transaction ID: ${tx.id || tx.transactionId}**\n`;
                        result += `  Plan ID: ${tx.planId}\n`;
                        result += `  Target Asset: ${tx.targetAsset}\n`;
                        result += `  Source Asset: ${tx.sourceAsset}\n`;
                        result += `  Source Amount: ${tx.sourceAmount || tx.sourceAssetAmount}\n`;
                        result += `  Target Amount: ${tx.targetAmount || tx.targetAssetAmount}\n`;
                        result += `  Status: ${tx.status}\n`;
                        result += `  Time: ${tx.transactionDateTime || new Date(tx.time).toISOString()}\n\n`;
                    });
                    if (history.length > 20) {
                        result += `... and ${history.length - 20} more transactions`;
                    }
                } else {
                    result += `No transaction history found`;
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
                        text: `❌ Failed to get auto-invest history: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
