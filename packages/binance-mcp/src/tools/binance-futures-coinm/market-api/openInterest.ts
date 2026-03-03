/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/market-api/openInterest.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryOpenInterest(server: McpServer) {
    server.tool(
        "BinanceDeliveryOpenInterest",
        "Get present open interest for a specific COIN-M Futures contract.",
        {
            symbol: z.string().describe("Contract symbol (e.g., BTCUSD_PERP)")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.openInterest({
                    symbol: params.symbol
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `📊 Open Interest for ${params.symbol}\n\nOpen Interest: ${data.openInterest}\nSymbol: ${data.symbol}\nPair: ${data.pair}\nContract Type: ${data.contractType}\nTime: ${new Date(data.time).toISOString()}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get open interest: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
