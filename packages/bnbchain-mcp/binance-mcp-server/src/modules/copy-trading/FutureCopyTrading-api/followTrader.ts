/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/copy-trading/FutureCopyTrading-api/followTrader.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { copyTradingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCopyTradingFollowTrader(server: McpServer) {
    server.tool(
        "BinanceCopyTradingFollowTrader",
        "Start following a lead trader to automatically copy their trades. ⚠️ RISK: Your funds will be used to copy trades. Only follow traders you trust.",
        {
            leadPortfolioId: z.string().describe("Lead trader's portfolio ID to follow"),
            copyRatio: z.number().min(0.1).max(10).describe("Copy ratio (0.1-10x of their trades)"),
            fixedAmount: z.string().optional().describe("Fixed amount per trade (alternative to ratio)"),
            stopLossRatio: z.number().min(0.01).max(1).optional()
                .describe("Stop loss ratio (e.g., 0.1 = stop if 10% loss)"),
            takeProfitRatio: z.number().min(0.01).optional()
                .describe("Take profit ratio (e.g., 0.5 = take profit at 50% gain)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await copyTradingClient.restAPI.followTrader({
                    leadPortfolioId: params.leadPortfolioId,
                    copyRatio: params.copyRatio,
                    ...(params.fixedAmount && { fixedAmount: params.fixedAmount }),
                    ...(params.stopLossRatio && { stopLossRatio: params.stopLossRatio }),
                    ...(params.takeProfitRatio && { takeProfitRatio: params.takeProfitRatio }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `✅ Now Following Trader!\n\nPortfolio: ${params.leadPortfolioId}\nCopy Ratio: ${params.copyRatio}x\nStop Loss: ${params.stopLossRatio ? (params.stopLossRatio * 100) + '%' : 'Not set'}\nTake Profit: ${params.takeProfitRatio ? (params.takeProfitRatio * 100) + '%' : 'Not set'}\n\n⚠️ Your trades will now automatically copy this trader.`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to follow trader: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
