/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/copy-trading/FutureCopyTrading-api/unfollowTrader.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { copyTradingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCopyTradingUnfollowTrader(server: McpServer) {
    server.tool(
        "BinanceCopyTradingUnfollowTrader",
        "Stop following a lead trader. Your existing copied positions will remain open until manually closed.",
        {
            leadPortfolioId: z.string().describe("Lead trader's portfolio ID to unfollow"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await copyTradingClient.restAPI.unfollowTrader({
                    leadPortfolioId: params.leadPortfolioId,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `✅ Stopped Following Trader!\n\nPortfolio: ${params.leadPortfolioId}\n\n💡 Note: Existing positions from copy trading are still open. You may want to close them manually.`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to unfollow trader: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
