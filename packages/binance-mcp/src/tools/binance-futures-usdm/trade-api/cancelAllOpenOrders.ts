/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/trade-api/cancelAllOpenOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../../config/binanceClient.js";

export function registerBinanceFuturesCancelAllOpenOrders(server: McpServer) {
    server.tool(
        "BinanceFuturesCancelAllOpenOrders",
        "Cancel all open orders for a symbol. Use with caution as this cancels ALL open orders.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., BTCUSDT)")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.cancelAllOpenOrders(params.symbol);

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
                            text: `Error canceling all futures orders: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
