/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/simple-earn/account/getRewardRecord.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { simpleEarnClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerSimpleEarnRewardRecord(server: McpServer) {
    server.tool(
        "BinanceSimpleEarnRewardRecord",
        "Get your reward distribution history. Shows all rewards earned from Simple Earn products.",
        {
            productId: z.string().optional().describe("Filter by product ID"),
            asset: z.string().optional().describe("Filter by asset"),
            type: z.enum(["BONUS", "REALTIME", "REWARDS"]).optional().describe("Filter by reward type"),
            startTime: z.number().int().optional().describe("Start time in ms"),
            endTime: z.number().int().optional().describe("End time in ms"),
            current: z.number().int().min(1).default(1).optional().describe("Page number"),
            size: z.number().int().min(1).max(100).default(10).optional().describe("Page size"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await simpleEarnClient.restAPI.getFlexibleRewardsRecord({
                    ...(params.productId && { productId: params.productId }),
                    ...(params.asset && { asset: params.asset }),
                    ...(params.type && { type: params.type }),
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
                        text: `🎁 Reward Records\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get reward records: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
