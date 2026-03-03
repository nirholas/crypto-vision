/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-copy-trading/FutureCopyTrading-api/getLeadTraders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { copyTradingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCopyTradingGetLeaders(server: McpServer) {
    server.tool(
        "BinanceCopyTradingGetLeaders",
        "Get a list of lead traders available for copy trading. Shows their performance metrics and follower count.",
        {
            pageNumber: z.number().int().min(1).optional()
                .describe("Page number for pagination"),
            pageSize: z.number().int().min(1).max(100).optional()
                .describe("Results per page (max 100)"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await copyTradingClient.restAPI.getLeadTraders({
                    ...(params.pageNumber && { pageNumber: params.pageNumber }),
                    ...(params.pageSize && { pageSize: params.pageSize }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `Lead Traders:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get lead traders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
