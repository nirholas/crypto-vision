// src/tools/binance-futures-usdm/leverage.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMLeverage(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMLeverage",
        "Change initial leverage for a symbol in USD-M Futures.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            leverage: z.number().describe("Target leverage (1-125)")
        },
        async ({ symbol, leverage }) => {
            try {
                const data = await futuresClient.leverage({ symbol, leverage });
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `USD-M Futures leverage changed to ${leverage}x for ${symbol}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to change USD-M Futures leverage: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
