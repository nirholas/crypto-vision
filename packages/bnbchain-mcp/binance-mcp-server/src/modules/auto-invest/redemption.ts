/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/auto-invest/redemption.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerAutoInvestRedemption(server: McpServer) {
    server.tool(
        "BinanceAutoInvestRedemption",
        "Redeem/sell assets from an auto-invest index plan.",
        {
            indexId: z.number().int().describe("Index ID to redeem from"),
            redemptionPercentage: z.number().min(0).max(100).describe("Percentage to redeem (0-100)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.redeem({
                    indexId: params.indexId,
                    redemptionPercentage: params.redemptionPercentage,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Auto-invest redemption successful!\n\nIndex ID: ${params.indexId}\nRedemption Percentage: ${params.redemptionPercentage}%\nTransaction ID: ${data.transactionId || data.redemptionId || 'Completed'}\n\nResponse: ${JSON.stringify(data)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to redeem from auto-invest: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
