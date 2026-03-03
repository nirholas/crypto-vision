/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/cross-margin-api/crossMarginPriceIndex.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginPriceIndex(server: McpServer) {
    server.tool(
        "BinanceCrossMarginPriceIndex",
        "Query margin price index for a specific symbol.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.queryMarginPriceIndex({
                    symbol: params.symbol
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Price Index for ${params.symbol}: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query price index: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
