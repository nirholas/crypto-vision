// src/tools/binance-margin/isolated-margin-api/isolatedMarginPair.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceIsolatedMarginPair(server: McpServer) {
    server.tool(
        "BinanceIsolatedMarginPair",
        "Query isolated margin symbol info including margin ratio, base/quote assets, and status.",
        {
            symbol: z.string().describe("Isolated margin symbol (e.g., BTCUSDT)"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.getIsolatedMarginPairs({
                    symbol: params.symbol,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Isolated Margin Pair Info for ${params.symbol}: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query pair info: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
