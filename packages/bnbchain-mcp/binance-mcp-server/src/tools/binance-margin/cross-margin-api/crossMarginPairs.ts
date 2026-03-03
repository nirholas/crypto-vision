/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/cross-margin-api/crossMarginPairs.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginPairs(server: McpServer) {
    server.tool(
        "BinanceCrossMarginPairs",
        "Query all cross margin pairs available for trading.",
        {
            symbol: z.string().optional().describe("Filter by specific symbol")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.getAllCrossMarginPairs({
                    ...(params.symbol && { symbol: params.symbol })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Cross Margin Pairs: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query cross margin pairs: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
