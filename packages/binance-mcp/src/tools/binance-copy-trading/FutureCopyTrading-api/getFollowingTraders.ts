// src/tools/binance-copy-trading/FutureCopyTrading-api/getFollowingTraders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { copyTradingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCopyTradingGetFollowing(server: McpServer) {
    server.tool(
        "BinanceCopyTradingGetFollowing",
        "Get list of traders you are currently following in copy trading.",
        {
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
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
                        text: `Traders You're Following:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get following traders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
