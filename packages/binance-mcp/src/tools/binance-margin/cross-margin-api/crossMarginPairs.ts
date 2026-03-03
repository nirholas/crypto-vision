// src/tools/binance-margin/cross-margin-api/crossMarginPairs.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginPairs(server: McpServer) {
    server.tool(
        "BinanceCrossMarginPairs",
        "Get all cross margin trading pairs. Returns information about all available cross margin pairs including base/quote assets and margin ratio.",
        {
            symbol: z.string().optional().describe("Filter by specific trading pair symbol")
        },
        async (params) => {
            try {
                const data = await marginClient.getAllPairs({
                    ...(params.symbol && { symbol: params.symbol })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Cross Margin Pairs: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get cross margin pairs: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
