// src/tools/binance-futures-coinm/openInterest.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deliveryClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesCOINMOpenInterest(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMOpenInterest",
        "Get present open interest of a specific symbol for COIN-M Futures.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSD_PERP)")
        },
        async ({ symbol }) => {
            try {
                const data = await deliveryClient.openInterest({ symbol });
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved COIN-M Futures open interest for ${symbol}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve COIN-M Futures open interest: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
