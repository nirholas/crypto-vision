/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/copy-trading/FutureCopyTrading-api/getFollowingTraders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { copyTradingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCopyTradingGetFollowingTraders(server: McpServer) {
    server.tool(
        "BinanceCopyTradingGetFollowingTraders",
        "Get the list of traders you are currently following. Shows copy settings and performance for each.",
        {
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await copyTradingClient.restAPI.getFollowingTraders({
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `👥 Traders You're Following\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get following traders: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
