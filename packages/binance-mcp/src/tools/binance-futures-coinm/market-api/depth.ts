/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/market-api/depth.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryDepth(server: McpServer) {
    server.tool(
        "BinanceDeliveryDepth",
        "Get COIN-M Futures order book depth for a symbol.",
        {
            symbol: z.string().describe("Contract symbol (e.g., BTCUSD_PERP, BTCUSD_230630)"),
            limit: z.number().int().optional().describe("Depth limit: 5, 10, 20, 50, 100, 500, 1000 (default 500)")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.depth({
                    symbol: params.symbol,
                    ...(params.limit && { limit: params.limit })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `📚 Order Book for ${params.symbol}\n\nLast Update ID: ${data.lastUpdateId}\nBids: ${data.bids?.length || 0}\nAsks: ${data.asks?.length || 0}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get order book: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
