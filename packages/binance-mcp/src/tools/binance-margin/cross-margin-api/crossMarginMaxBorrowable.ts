// src/tools/binance-margin/cross-margin-api/crossMarginMaxBorrowable.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginMaxBorrowable(server: McpServer) {
    server.tool(
        "BinanceCrossMarginMaxBorrowable",
        "Query maximum borrowable amount for an asset in Cross Margin.",
        {
            asset: z.string().describe("Asset (e.g., BTC, USDT)"),
            isolatedSymbol: z.string().optional().describe("Isolated symbol"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.getMaxBorrowable({
                    asset: params.asset,
                    ...(params.isolatedSymbol && { isolatedSymbol: params.isolatedSymbol }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Max Borrowable for ${params.asset}: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query max borrowable: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
