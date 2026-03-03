/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/isolated-margin-api/enableIsolatedMarginAccount.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceEnableIsolatedMarginAccount(server: McpServer) {
    server.tool(
        "BinanceEnableIsolatedMarginAccount",
        "Enable isolated margin account for a specific symbol.",
        {
            symbol: z.string().describe("Symbol to enable isolated margin for (e.g., BTCUSDT)"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.enableIsolatedMarginAccount({
                    symbol: params.symbol,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Isolated margin account enabled for ${params.symbol}: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to enable isolated margin: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
