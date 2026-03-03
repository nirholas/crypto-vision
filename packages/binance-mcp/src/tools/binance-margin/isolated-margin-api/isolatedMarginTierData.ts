// src/tools/binance-margin/isolated-margin-api/isolatedMarginTierData.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceIsolatedMarginTierData(server: McpServer) {
    server.tool(
        "BinanceIsolatedMarginTierData",
        "Query isolated margin tier data showing leverage tiers and maintenance margin ratios for a symbol.",
        {
            symbol: z.string().describe("Isolated margin symbol (e.g., BTCUSDT)"),
            tier: z.number().int().optional().describe("Specific tier to query"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.getIsolatedMarginTier({
                    symbol: params.symbol,
                    ...(params.tier !== undefined && { tier: params.tier }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

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
