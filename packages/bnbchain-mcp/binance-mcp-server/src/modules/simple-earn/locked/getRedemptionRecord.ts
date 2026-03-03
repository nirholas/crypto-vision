/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/simple-earn/locked/getRedemptionRecord.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { simpleEarnClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerSimpleEarnLockedRedemptionRecord(server: McpServer) {
    server.tool(
        "BinanceSimpleEarnLockedRedemptionRecord",
        "Get your locked product redemption history. Shows all redemptions including early redemptions and matured positions.",
        {
            positionId: z.string().optional().describe("Filter by position ID"),
            redeemId: z.string().optional().describe("Filter by redemption ID"),
            asset: z.string().optional().describe("Filter by asset"),
            startTime: z.number().int().optional().describe("Start time in ms"),
            endTime: z.number().int().optional().describe("End time in ms"),
            current: z.number().int().min(1).default(1).optional().describe("Page number"),
            size: z.number().int().min(1).max(100).default(10).optional().describe("Page size"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await simpleEarnClient.restAPI.getLockedRedemptionRecord({
                    ...(params.positionId && { positionId: params.positionId }),
                    ...(params.redeemId && { redeemId: params.redeemId }),
                    ...(params.asset && { asset: params.asset }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.current && { current: params.current }),
                    ...(params.size && { size: params.size }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `📜 Locked Redemption Records\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get redemption records: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
