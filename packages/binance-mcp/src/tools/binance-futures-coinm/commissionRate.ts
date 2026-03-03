// src/tools/binance-futures-coinm/commissionRate.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deliveryClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesCOINMCommissionRate(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMCommissionRate",
        "Get user commission rate for COIN-M Futures.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSD_PERP)")
        },
        async ({ symbol }) => {
            try {
                const data = await deliveryClient.commissionRate({ symbol });
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved COIN-M Futures commission rate for ${symbol}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve COIN-M Futures commission rate: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
