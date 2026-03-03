/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/cross-margin-api/crossMarginSmallLiabilityExchangeHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginSmallLiabilityExchangeHistory(server: McpServer) {
    server.tool(
        "BinanceCrossMarginSmallLiabilityExchangeHistory",
        "Query small liability exchange history in Cross Margin account.",
        {
            current: z.number().int().optional().describe("Current page, default 1"),
            size: z.number().int().optional().describe("Page size, default 10, max 100"),
            startTime: z.number().int().optional().describe("Start timestamp in ms"),
            endTime: z.number().int().optional().describe("End timestamp in ms"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.getCrossMarginSmallLiabilityExchangeHistory({
                    ...(params.current && { current: params.current }),
                    ...(params.size && { size: params.size }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Small Liability Exchange History: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query exchange history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
