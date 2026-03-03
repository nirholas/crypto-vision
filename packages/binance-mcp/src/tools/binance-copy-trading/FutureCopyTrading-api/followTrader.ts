// src/tools/binance-copy-trading/FutureCopyTrading-api/followTrader.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { copyTradingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCopyTradingFollow(server: McpServer) {
    server.tool(
        "BinanceCopyTradingFollow",
        "Start following a lead trader in copy trading. ⚠️ WARNING: This will automatically copy their trades. You are trusting another trader with your capital. Past performance does not guarantee future results.",
        {
            portfolioId: z.string()
                .describe("Lead trader's portfolio ID to follow"),
            copyRatio: z.number().min(0.1).max(10).optional()
                .describe("Copy ratio multiplier (0.1-10x, default 1x)"),
            stopLossRatio: z.number().min(0.01).max(1).optional()
                .describe("Stop loss ratio (e.g., 0.1 = 10% loss triggers stop)"),
            takeProfitRatio: z.number().min(0.01).optional()
                .describe("Take profit ratio (e.g., 0.5 = 50% profit triggers exit)"),
            fixedAmount: z.string().optional()
                .describe("Fixed amount per trade instead of ratio"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await copyTradingClient.restAPI.followLeadTrader({
                    portfolioId: params.portfolioId,
                    ...(params.copyRatio && { copyRatio: params.copyRatio }),
                    ...(params.stopLossRatio && { stopLossRatio: params.stopLossRatio }),
                    ...(params.takeProfitRatio && { takeProfitRatio: params.takeProfitRatio }),
                    ...(params.fixedAmount && { fixedAmount: params.fixedAmount }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `✅ Now following trader ${params.portfolioId}!\n\nCopy Ratio: ${params.copyRatio || 1}x\nStop Loss: ${params.stopLossRatio ? (params.stopLossRatio * 100) + '%' : 'Not set'}\nTake Profit: ${params.takeProfitRatio ? (params.takeProfitRatio * 100) + '%' : 'Not set'}\n\n⚠️ Monitor your positions regularly.\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to follow trader: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
