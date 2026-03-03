/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/simple-earn/locked/setAutoSubscribe.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { simpleEarnClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerSimpleEarnSetAutoSubscribe(server: McpServer) {
    server.tool(
        "BinanceSimpleEarnLockedSetAutoSubscribe",
        "Enable or disable auto-subscribe for a locked position. When enabled, funds automatically re-subscribe when the lock period ends.",
        {
            positionId: z.string().describe("Position ID to update"),
            autoSubscribe: z.boolean().describe("Enable (true) or disable (false) auto-subscribe"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await simpleEarnClient.restAPI.setLockedAutoSubscribe({
                    positionId: params.positionId,
                    autoSubscribe: params.autoSubscribe,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `✅ Auto-Subscribe Updated!\n\nPosition ID: ${params.positionId}\nAuto-Subscribe: ${params.autoSubscribe ? 'Enabled' : 'Disabled'}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to update auto-subscribe: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
