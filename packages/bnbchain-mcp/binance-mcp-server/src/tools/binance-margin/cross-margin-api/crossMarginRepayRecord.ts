/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/cross-margin-api/crossMarginRepayRecord.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginRepayRecord(server: McpServer) {
    server.tool(
        "BinanceCrossMarginRepayRecord",
        "Query repay record for Cross Margin account.",
        {
            asset: z.string().describe("Asset (e.g., BTC, USDT)"),
            isolatedSymbol: z.string().optional().describe("Isolated symbol"),
            txId: z.number().int().optional().describe("Transaction ID"),
            startTime: z.number().int().optional().describe("Start timestamp in ms"),
            endTime: z.number().int().optional().describe("End timestamp in ms"),
            current: z.number().int().optional().describe("Current page, default 1"),
            size: z.number().int().optional().describe("Page size, default 10, max 100"),
            archived: z.boolean().optional().describe("Query archived data, default false"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.queryBorrowRepayRecords({
                    asset: params.asset,
                    type: "REPAY",
                    ...(params.isolatedSymbol && { isolatedSymbol: params.isolatedSymbol }),
                    ...(params.txId && { txId: params.txId }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.current && { current: params.current }),
                    ...(params.size && { size: params.size }),
                    ...(params.archived !== undefined && { archived: params.archived }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Repay Records: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query repay records: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
