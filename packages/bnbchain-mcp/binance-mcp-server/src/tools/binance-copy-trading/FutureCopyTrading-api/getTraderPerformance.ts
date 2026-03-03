// src/tools/binance-copy-trading/FutureCopyTrading-api/getTraderPerformance.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { copyTradingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCopyTradingGetPerformance(server: McpServer) {
    server.tool(
        "BinanceCopyTradingGetPerformance",
        "Get detailed performance statistics for a specific lead trader. Includes ROI, win rate, PnL history.",
        {
            portfolioId: z.string()
                .describe("Lead trader's portfolio ID"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await copyTradingClient.restAPI.getLeadTraderPerformance({
                    portfolioId: params.portfolioId,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `Trader Performance for ${params.portfolioId}:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get trader performance: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
