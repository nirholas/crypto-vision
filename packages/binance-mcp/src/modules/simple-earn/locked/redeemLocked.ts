/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/simple-earn/locked/redeemLocked.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { simpleEarnClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerSimpleEarnRedeemLocked(server: McpServer) {
    server.tool(
        "BinanceSimpleEarnLockedRedeem",
        "Redeem from a Simple Earn Locked product. ⚠️ Early redemption may forfeit rewards. Check product terms first.",
        {
            positionId: z.string().describe("Position ID to redeem"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await simpleEarnClient.restAPI.redeemLockedProduct({
                    positionId: params.positionId,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `✅ Locked Product Redemption Initiated!\n\nPosition ID: ${params.positionId}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to redeem locked product: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
