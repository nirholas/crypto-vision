/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/auto-invest/getIndexUserSummary.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerAutoInvestGetIndexUserSummary(server: McpServer) {
    server.tool(
        "BinanceAutoInvestGetIndexUserSummary",
        "Get user's auto-invest index subscription summary.",
        {
            indexId: z.number().int().describe("Index ID to query"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.indexUserSummary({
                    indexId: params.indexId,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Auto-Invest Index User Summary\n\n`;
                result += `Index ID: ${params.indexId}\n\n`;
                
                if (data) {
                    result += `Total Invested: ${data.totalInvestedInUSD || data.totalInvested || 'N/A'}\n`;
                    result += `Current Value: ${data.currentInvestedInUSD || data.currentValue || 'N/A'}\n`;
                    result += `PnL: ${data.pnlInUSD || data.pnl || 'N/A'}\n`;
                    result += `ROI: ${data.roi || 'N/A'}%\n`;
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
                        text: `❌ Failed to get auto-invest index user summary: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
