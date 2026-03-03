// src/tools/binance-copy-trading/FutureCopyTrading-api/getCopyOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { copyTradingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCopyTradingGetOrders(server: McpServer) {
    server.tool(
        "BinanceCopyTradingGetOrders",
        "Get copy trading orders. Shows orders that were placed as a result of following lead traders.",
        {
            portfolioId: z.string().optional()
                .describe("Filter by specific lead trader portfolio ID"),
            symbol: z.string().optional()
                .describe("Filter by trading symbol"),
            startTime: z.number().int().optional()
                .describe("Start timestamp in ms"),
            endTime: z.number().int().optional()
                .describe("End timestamp in ms"),
            pageNumber: z.number().int().min(1).optional()
                .describe("Page number"),
            pageSize: z.number().int().min(1).max(100).optional()
                .describe("Results per page"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await copyTradingClient.restAPI.getCopyTradingOrders({
                    ...(params.portfolioId && { portfolioId: params.portfolioId }),
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.pageNumber && { pageNumber: params.pageNumber }),
                    ...(params.pageSize && { pageSize: params.pageSize }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `Copy Trading Orders:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get copy orders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
