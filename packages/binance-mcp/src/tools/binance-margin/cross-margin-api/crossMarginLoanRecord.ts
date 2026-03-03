// src/tools/binance-margin/cross-margin-api/crossMarginLoanRecord.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginLoanRecord(server: McpServer) {
    server.tool(
        "BinanceCrossMarginLoanRecord",
        "Query loan record for Cross Margin account.",
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
                const data = await marginClient.getLoanRecord({
                    asset: params.asset,
                    ...(params.isolatedSymbol && { isolatedSymbol: params.isolatedSymbol }),
                    ...(params.txId && { txId: params.txId }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.current && { current: params.current }),
                    ...(params.size && { size: params.size }),
                    ...(params.archived !== undefined && { archived: params.archived }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Loan Records: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query loan records: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
