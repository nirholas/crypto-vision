/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/market-api/aggTrades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryAggTrades(server: McpServer) {
    server.tool(
        "BinanceDeliveryAggTrades",
        "Get compressed/aggregate trades for a COIN-M Futures symbol. Trades that fill at the same time, from the same order, with the same price will be aggregated.",
        {
            symbol: z.string().describe("Contract symbol (e.g., BTCUSD_PERP)"),
            fromId: z.number().int().optional().describe("ID to get aggregate trades from INCLUSIVE"),
            startTime: z.number().int().optional().describe("Start timestamp in milliseconds"),
            endTime: z.number().int().optional().describe("End timestamp in milliseconds"),
            limit: z.number().int().optional().describe("Number of trades (default 500, max 1000)")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.aggTrades({
                    symbol: params.symbol,
                    ...(params.fromId && { fromId: params.fromId }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `📊 Aggregate Trades for ${params.symbol}\n\nTrades: ${Array.isArray(data) ? data.length : 0}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get aggregate trades: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
