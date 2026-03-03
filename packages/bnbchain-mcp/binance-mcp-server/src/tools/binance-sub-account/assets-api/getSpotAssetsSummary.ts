/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-sub-account/assets-api/getSpotAssetsSummary.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spotClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceSubAccountSpotSummary(server: McpServer) {
    server.tool(
        "BinanceSubAccountSpotSummary",
        "Get spot account summary for all sub-accounts. Returns aggregated BTC value of all sub-account spot wallets.",
        {
            email: z.string().email().optional()
                .describe("Filter by specific sub-account email"),
            page: z.number().int().min(1).optional()
                .describe("Page number (starts from 1)"),
            size: z.number().int().min(1).max(20).optional()
                .describe("Number of results per page (max 20)"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await spotClient.restAPI.querySubAccountSpotAssetsSummary({
                    ...(params.email && { email: params.email }),
                    ...(params.page && { page: params.page }),
                    ...(params.size && { size: params.size }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `Sub-Account Spot Assets Summary:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get spot summary: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
