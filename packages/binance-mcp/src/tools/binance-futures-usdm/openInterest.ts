// src/tools/binance-futures-usdm/openInterest.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMOpenInterest(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMOpenInterest",
        "Get present open interest of a specific symbol for USD-M Futures.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)")
        },
        async ({ symbol }) => {
            try {
                const data = await futuresClient.openInterest({ symbol });
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved USD-M Futures open interest for ${symbol}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve USD-M Futures open interest: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
