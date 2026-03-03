/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/simple-earn/locked/getLockedPosition.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { simpleEarnClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerSimpleEarnLockedPosition(server: McpServer) {
    server.tool(
        "BinanceSimpleEarnLockedPosition",
        "Get your current Simple Earn Locked positions. Shows locked amount, rewards, maturity date, and APR.",
        {
            asset: z.string().optional().describe("Filter by asset symbol"),
            positionId: z.string().optional().describe("Filter by position ID"),
            projectId: z.string().optional().describe("Filter by project ID"),
            current: z.number().int().min(1).default(1).optional().describe("Page number"),
            size: z.number().int().min(1).max(100).default(10).optional().describe("Page size"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await simpleEarnClient.restAPI.getLockedProductPosition({
                    ...(params.asset && { asset: params.asset }),
                    ...(params.positionId && { positionId: params.positionId }),
                    ...(params.projectId && { projectId: params.projectId }),
                    ...(params.current && { current: params.current }),
                    ...(params.size && { size: params.size }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `📊 Your Locked Earn Positions\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get locked positions: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
