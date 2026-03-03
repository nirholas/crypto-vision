/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/market-api/historicalTrades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesHistoricalTrades(server: McpServer) {
    server.tool(
        "BinanceFuturesHistoricalTrades",
        "Get older trades for a USD-M Futures symbol.",
        {
            symbol: z.string().describe("Futures symbol (e.g., BTCUSDT)"),
            limit: z.number().int().optional().describe("Number of trades. Default 500, max 1000"),
            fromId: z.number().int().optional().describe("Trade ID to start from")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.historicalTrades({
                    symbol: params.symbol,
                    ...(params.limit && { limit: params.limit }),
                    ...(params.fromId !== undefined && { fromId: params.fromId })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Historical Futures Trades for ${params.symbol}: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get historical trades: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
