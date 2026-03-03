/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/market-api/historicalTrades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryHistoricalTrades(server: McpServer) {
    server.tool(
        "BinanceDeliveryHistoricalTrades",
        "Get older market historical trades for a COIN-M Futures symbol. Requires API key.",
        {
            symbol: z.string().describe("Contract symbol (e.g., BTCUSD_PERP)"),
            limit: z.number().int().optional().describe("Number of trades (default 500, max 1000)"),
            fromId: z.number().int().optional().describe("Trade ID to fetch from (older trades)")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.historicalTrades({
                    symbol: params.symbol,
                    ...(params.limit && { limit: params.limit }),
                    ...(params.fromId && { fromId: params.fromId })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `📜 Historical Trades for ${params.symbol}\n\nTrades: ${Array.isArray(data) ? data.length : 0}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get historical trades: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
