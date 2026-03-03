// src/tools/binance-futures-usdm/commissionRate.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMCommissionRate(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMCommissionRate",
        "Get user commission rate for USD-M Futures.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)")
        },
        async ({ symbol }) => {
            try {
                const data = await futuresClient.commissionRate({ symbol });

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved USD-M Futures commission rate for ${symbol}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve USD-M Futures commission rate: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
