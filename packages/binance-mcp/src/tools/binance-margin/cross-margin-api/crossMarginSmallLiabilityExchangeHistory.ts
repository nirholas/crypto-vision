// src/tools/binance-margin/cross-margin-api/crossMarginSmallLiabilityExchangeHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginSmallLiabilityExchangeHistory(server: McpServer) {
    server.tool(
        "BinanceCrossMarginSmallLiabilityExchangeHistory",
        "Get cross margin small liability exchange history.",
        {
            current: z.number().int().optional().describe("Current page (default 1)"),
            size: z.number().int().optional().describe("Page size (default 10, max 100)"),
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.getSmallLiabilityExchangeHistory({
                    ...(params.current && { current: params.current }),
                    ...(params.size && { size: params.size }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Small Liability Exchange History: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get exchange history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
