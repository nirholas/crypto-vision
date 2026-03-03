// src/tools/binance-futures-usdm/cancelAllOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMCancelAllOrders(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMCancelAllOrders",
        "Cancel all open orders for a symbol in USD-M Futures.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)")
        },
        async ({ symbol }) => {
            try {
                const data = await futuresClient.cancelAllOpenOrders({ symbol });

                return {
                    content: [
                        {
                            type: "text",
                            text: `All USD-M Futures open orders cancelled for ${symbol}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to cancel USD-M Futures open orders: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
