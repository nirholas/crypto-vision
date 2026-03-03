/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-auto-invest/redemption.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceAutoInvestRedemption(server: McpServer) {
    server.tool(
        "BinanceAutoInvestRedemption",
        "Redeem (sell) holdings from an auto-invest index-linked plan.",
        {
            indexId: z.number().int().describe("Index ID to redeem from"),
            redemptionPercentage: z.number().min(0).max(100).describe("Percentage of holdings to redeem (0-100)"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.redemption({
                    indexId: params.indexId,
                    redemptionPercentage: params.redemptionPercentage,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Redemption executed!\n\nRedeemed ${params.redemptionPercentage}% from index ${params.indexId}\n\nDetails:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to redeem: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
