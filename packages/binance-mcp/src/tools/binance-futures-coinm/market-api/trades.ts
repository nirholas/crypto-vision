/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/market-api/trades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryTrades(server: McpServer) {
    server.tool(
        "BinanceDeliveryTrades",
        "Get recent trades for a COIN-M Futures symbol.",
        {
            symbol: z.string().describe("Contract symbol (e.g., BTCUSD_PERP)"),
            limit: z.number().int().optional().describe("Number of trades (default 500, max 1000)")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.trades({
                    symbol: params.symbol,
                    ...(params.limit && { limit: params.limit })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `📈 Recent Trades for ${params.symbol}\n\nTrades: ${Array.isArray(data) ? data.length : 0}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get trades: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
