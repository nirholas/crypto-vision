/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/isolated-margin-api/isolatedMarginTierData.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceIsolatedMarginTierData(server: McpServer) {
    server.tool(
        "BinanceIsolatedMarginTierData",
        "Query isolated margin tier data for margin level brackets and limits.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            tier: z.number().int().optional().describe("Specific tier level to query"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.queryIsolatedMarginTierData({
                    symbol: params.symbol,
                    ...(params.tier !== undefined && { tier: params.tier }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Isolated Margin Tier Data for ${params.symbol}: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query tier data: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
