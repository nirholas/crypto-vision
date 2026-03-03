/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/trade-api/openOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../../config/binanceClient.js";

export function registerBinanceFuturesOpenOrders(server: McpServer) {
    server.tool(
        "BinanceFuturesOpenOrders",
        "Get all current open orders. If symbol is provided, returns orders for that symbol only. Otherwise returns all open orders (use with caution due to rate limits).",
        {
            symbol: z.string().optional().describe("Trading pair symbol (e.g., BTCUSDT). If omitted, returns all open orders.")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.currentAllOpenOrders({
                    symbol: params.symbol
                });

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(response.data, null, 2)
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Error getting open orders: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
