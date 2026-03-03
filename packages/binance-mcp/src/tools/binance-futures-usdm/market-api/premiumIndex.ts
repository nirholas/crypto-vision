/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/market-api/premiumIndex.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesPremiumIndex(server: McpServer) {
    server.tool(
        "BinanceFuturesPremiumIndex",
        "Get mark price and funding rate for USD-M Futures symbols.",
        {
            symbol: z.string().optional().describe("Futures symbol (e.g., BTCUSDT). If omitted, returns all symbols")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.premiumIndex({
                    ...(params.symbol && { symbol: params.symbol })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Premium Index: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get premium index: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
