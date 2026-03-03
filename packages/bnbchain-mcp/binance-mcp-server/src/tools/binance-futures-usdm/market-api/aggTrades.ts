/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/market-api/aggTrades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesAggTrades(server: McpServer) {
    server.tool(
        "BinanceFuturesAggTrades",
        "Get compressed aggregate trades for a USD-M Futures symbol.",
        {
            symbol: z.string().describe("Futures symbol (e.g., BTCUSDT)"),
            fromId: z.number().int().optional().describe("Trade ID to start from"),
            startTime: z.number().int().optional().describe("Start timestamp in ms"),
            endTime: z.number().int().optional().describe("End timestamp in ms"),
            limit: z.number().int().optional().describe("Number of trades. Default 500, max 1000")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.aggTrades({
                    symbol: params.symbol,
                    ...(params.fromId !== undefined && { fromId: params.fromId }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Aggregate Trades for ${params.symbol}: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get aggregate trades: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
