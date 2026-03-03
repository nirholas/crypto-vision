/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/market-api/tickerPrice.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryTickerPrice(server: McpServer) {
    server.tool(
        "BinanceDeliveryTickerPrice",
        "Get latest price for COIN-M Futures symbol(s).",
        {
            symbol: z.string().optional().describe("Contract symbol (e.g., BTCUSD_PERP). If not provided, returns all symbols"),
            pair: z.string().optional().describe("Filter by underlying pair (e.g., BTCUSD)")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.tickerPrice({
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.pair && { pair: params.pair })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `💰 Symbol Price${params.symbol ? ` for ${params.symbol}` : ''}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get ticker price: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
