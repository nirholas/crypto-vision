/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/isolated-margin-api/isolatedMarginAccount.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceIsolatedMarginAccount(server: McpServer) {
    server.tool(
        "BinanceIsolatedMarginAccount",
        "Query isolated margin account details for all symbols or a specific symbol.",
        {
            symbols: z.string().optional().describe("Comma-separated symbols (e.g., BTCUSDT,ETHUSDT). Max 5 symbols."),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.queryIsolatedMarginAccountInfo({
                    ...(params.symbols && { symbols: params.symbols }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Isolated Margin Account: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query isolated margin account: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
