/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/cross-margin-api/crossMarginInterestRateHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginInterestRateHistory(server: McpServer) {
    server.tool(
        "BinanceCrossMarginInterestRateHistory",
        "Query interest rate history for margin assets.",
        {
            asset: z.string().describe("Asset (e.g., BTC, USDT)"),
            vipLevel: z.number().int().optional().describe("VIP level, defaults to user's VIP level"),
            startTime: z.number().int().optional().describe("Start timestamp in ms"),
            endTime: z.number().int().optional().describe("End timestamp in ms"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.queryMarginInterestRateHistory({
                    asset: params.asset,
                    ...(params.vipLevel !== undefined && { vipLevel: params.vipLevel }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Interest Rate History for ${params.asset}: ${JSON.stringify(data, null, 2)}`
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
