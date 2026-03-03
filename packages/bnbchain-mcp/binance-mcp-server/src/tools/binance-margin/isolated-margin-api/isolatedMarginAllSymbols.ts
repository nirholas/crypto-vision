/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/isolated-margin-api/isolatedMarginAllSymbols.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceIsolatedMarginAllSymbols(server: McpServer) {
    server.tool(
        "BinanceIsolatedMarginAllSymbols",
        "Query all isolated margin symbols available for trading.",
        {
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.getAllIsolatedMarginSymbol({
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `All Isolated Margin Symbols: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query all symbols: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
