// src/tools/binance-futures-coinm/premiumIndex.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deliveryClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesCOINMPremiumIndex(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMPremiumIndex",
        "Get mark price and funding rate for COIN-M Futures.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (e.g., BTCUSD_PERP). If not provided, returns all symbols")
        },
        async ({ symbol }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;

                const data = await deliveryClient.premiumIndex(params);
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved COIN-M Futures premium index${symbol ? ` for ${symbol}` : ' for all symbols'}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve COIN-M Futures premium index: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
