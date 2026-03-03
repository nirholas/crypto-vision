// src/tools/binance-margin/cross-margin-api/crossMarginPriceIndex.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginPriceIndex(server: McpServer) {
    server.tool(
        "BinanceCrossMarginPriceIndex",
        "Query margin price index for a specific trading pair. Returns the current price index used for margin calculations.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., BTCUSDT)")
        },
        async (params) => {
            try {
                const data = await marginClient.getPriceIndex({
                    symbol: params.symbol
                });

                return {
                    content: [{
                        type: "text",
                        text: `Margin Price Index for ${params.symbol}: ${JSON.stringify(data, null, 2)}`
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
