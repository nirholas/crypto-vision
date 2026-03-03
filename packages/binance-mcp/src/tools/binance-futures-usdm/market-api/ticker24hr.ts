/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/market-api/ticker24hr.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesTicker24hr(server: McpServer) {
    server.tool(
        "BinanceFuturesTicker24hr",
        "Get 24 hour rolling window price change statistics for USD-M Futures.",
        {
            symbol: z.string().optional().describe("Futures symbol. If omitted, returns all symbols")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.ticker24hr({
                    ...(params.symbol && { symbol: params.symbol })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `24hr Ticker: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get 24hr ticker: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
