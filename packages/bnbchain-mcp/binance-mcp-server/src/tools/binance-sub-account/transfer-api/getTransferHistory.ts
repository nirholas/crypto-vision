/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-sub-account/transfer-api/getTransferHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spotClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceSubAccountTransferHistory(server: McpServer) {
    server.tool(
        "BinanceSubAccountTransferHistory",
        "Get transfer history for sub-accounts. Shows all internal transfers between master and sub-accounts.",
        {
            asset: z.string().optional()
                .describe("Filter by specific asset"),
            type: z.enum(["1", "2"]).optional()
                .describe("Transfer type: 1 = transfer in, 2 = transfer out"),
            startTime: z.number().int().optional()
                .describe("Start timestamp in ms"),
            endTime: z.number().int().optional()
                .describe("End timestamp in ms"),
            limit: z.number().int().min(1).max(500).optional()
                .describe("Number of results (max 500)"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await spotClient.restAPI.querySubAccountTransferHistoryV1({
                    ...(params.asset && { asset: params.asset }),
                    ...(params.type && { type: params.type }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `Sub-Account Transfer History:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get transfer history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
