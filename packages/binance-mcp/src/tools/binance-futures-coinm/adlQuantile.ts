// src/tools/binance-futures-coinm/adlQuantile.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deliveryClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesCOINMADLQuantile(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMADLQuantile",
        "Get position ADL (Auto-Deleveraging) quantile estimate for COIN-M Futures.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (e.g., BTCUSD_PERP). If not provided, returns all positions")
        },
        async ({ symbol }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;

                const data = await deliveryClient.adlQuantile(params);
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved COIN-M Futures ADL quantile${symbol ? ` for ${symbol}` : ' for all positions'}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve COIN-M Futures ADL quantile: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
