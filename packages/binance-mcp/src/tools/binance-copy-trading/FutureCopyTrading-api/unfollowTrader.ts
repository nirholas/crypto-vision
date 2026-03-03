// src/tools/binance-copy-trading/FutureCopyTrading-api/unfollowTrader.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { copyTradingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCopyTradingUnfollow(server: McpServer) {
    server.tool(
        "BinanceCopyTradingUnfollow",
        "Stop following a lead trader. This will stop copying their trades but won't close existing positions.",
        {
            portfolioId: z.string()
                .describe("Lead trader's portfolio ID to unfollow"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await copyTradingClient.restAPI.unfollowLeadTrader({
                    portfolioId: params.portfolioId,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `✅ Stopped following trader ${params.portfolioId}\n\n📝 Note: Existing copied positions remain open. Close them manually if needed.\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to unfollow trader: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
