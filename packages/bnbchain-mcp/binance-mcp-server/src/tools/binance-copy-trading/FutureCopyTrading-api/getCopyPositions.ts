// src/tools/binance-copy-trading/FutureCopyTrading-api/getCopyPositions.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { copyTradingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCopyTradingGetPositions(server: McpServer) {
    server.tool(
        "BinanceCopyTradingGetPositions",
        "Get current copy trading positions. Shows open positions from following lead traders.",
        {
            portfolioId: z.string().optional()
                .describe("Filter by specific lead trader portfolio ID"),
            symbol: z.string().optional()
                .describe("Filter by trading symbol"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await copyTradingClient.restAPI.getCopyTradingPositions({
                    ...(params.portfolioId && { portfolioId: params.portfolioId }),
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `Copy Trading Positions:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get copy positions: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
