/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/market-api/trades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesTrades(server: McpServer) {
    server.tool(
        "BinanceFuturesTrades",
        "Get recent trades for a USD-M Futures symbol.",
        {
            symbol: z.string().describe("Futures symbol (e.g., BTCUSDT)"),
            limit: z.number().int().optional().describe("Number of trades to return. Default 500, max 1000")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.trades({
                    symbol: params.symbol,
                    ...(params.limit && { limit: params.limit })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Recent Futures Trades for ${params.symbol}: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get trades: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
