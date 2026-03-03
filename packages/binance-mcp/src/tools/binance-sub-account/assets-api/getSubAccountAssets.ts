/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-sub-account/assets-api/getSubAccountAssets.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spotClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceSubAccountAssets(server: McpServer) {
    server.tool(
        "BinanceSubAccountAssets",
        "Get detailed asset balances for a specific sub-account. Shows all tokens and their free/locked amounts.",
        {
            email: z.string().email()
                .describe("Sub-account email to query assets for"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await spotClient.restAPI.querySubAccountAssetsV4({
                    email: params.email,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `Sub-Account Assets for ${params.email}:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get sub-account assets: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
