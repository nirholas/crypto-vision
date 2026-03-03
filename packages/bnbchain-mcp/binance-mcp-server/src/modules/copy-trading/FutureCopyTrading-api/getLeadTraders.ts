/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/copy-trading/FutureCopyTrading-api/getLeadTraders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { copyTradingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetLeadTraders(server: McpServer) {
    server.tool(
        "BinanceCopyTradingGetLeadTraders",
        "Browse available lead traders for copy trading. View their performance stats and follower count to find traders to copy.",
        {
            isShared: z.boolean().optional().describe("Filter by shared portfolio traders"),
            tradeType: z.enum(["PERPETUAL"]).optional().describe("Trade type filter"),
            pageNumber: z.number().int().min(1).default(1).optional().describe("Page number"),
            pageSize: z.number().int().min(1).max(100).default(10).optional().describe("Page size"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await copyTradingClient.restAPI.getLeadTraders({
                    ...(params.isShared !== undefined && { isShared: params.isShared }),
                    ...(params.tradeType && { tradeType: params.tradeType }),
                    ...(params.pageNumber && { pageNumber: params.pageNumber }),
                    ...(params.pageSize && { pageSize: params.pageSize }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `👥 Lead Traders\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get lead traders: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
