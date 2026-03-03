/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-sub-account/assets-api/getFuturesAssetsSummary.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spotClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceSubAccountFuturesSummary(server: McpServer) {
    server.tool(
        "BinanceSubAccountFuturesSummary",
        "Get futures account summary for all sub-accounts. Returns total initial margin, maintenance margin, and unrealized PnL.",
        {
            futuresType: z.enum(["1", "2"]).optional()
                .describe("Futures type: 1 for USD-M, 2 for COIN-M"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await spotClient.restAPI.getSubAccountFuturesAccountSummaryV2({
                    ...(params.futuresType && { futuresType: params.futuresType }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `Sub-Account Futures Summary:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get futures summary: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
