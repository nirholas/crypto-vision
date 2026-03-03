// src/tools/binance-margin/cross-margin-api/crossMarginInterestRateHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginInterestRateHistory(server: McpServer) {
    server.tool(
        "BinanceCrossMarginInterestRateHistory",
        "Query margin interest rate history for a specific asset.",
        {
            asset: z.string().describe("Asset symbol (e.g., BTC, USDT)"),
            vipLevel: z.number().int().optional().describe("VIP level (default uses current account VIP level)"),
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.getInterestRateHistory({
                    asset: params.asset,
                    ...(params.vipLevel !== undefined && { vipLevel: params.vipLevel }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Margin Interest Rate History for ${params.asset}: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query interest rate history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
