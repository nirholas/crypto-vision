/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-margin/isolated-margin-api/isolatedMarginTransferHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceIsolatedMarginTransferHistory(server: McpServer) {
    server.tool(
        "BinanceIsolatedMarginTransferHistory",
        "Query isolated margin transfer history.",
        {
            symbol: z.string().optional().describe("Isolated margin symbol"),
            asset: z.string().optional().describe("Asset"),
            transFrom: z.enum(["SPOT", "ISOLATED_MARGIN"]).optional().describe("Transfer from"),
            transTo: z.enum(["SPOT", "ISOLATED_MARGIN"]).optional().describe("Transfer to"),
            startTime: z.number().int().optional().describe("Start timestamp in ms"),
            endTime: z.number().int().optional().describe("End timestamp in ms"),
            current: z.number().int().optional().describe("Current page, default 1"),
            size: z.number().int().optional().describe("Page size, default 10, max 100"),
            archived: z.boolean().optional().describe("Query archived data"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.getIsolatedMarginTransferHistory({
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.asset && { asset: params.asset }),
                    ...(params.transFrom && { transFrom: params.transFrom }),
                    ...(params.transTo && { transTo: params.transTo }),
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
                        text: `Isolated Margin Transfer History: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query transfer history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
