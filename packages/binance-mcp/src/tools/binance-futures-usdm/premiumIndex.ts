// src/tools/binance-futures-usdm/premiumIndex.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMPremiumIndex(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMPremiumIndex",
        "Get mark price and funding rate for USD-M Futures.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (e.g., BTCUSDT). If not provided, returns all symbols")
        },
        async ({ symbol }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;

                const data = await futuresClient.premiumIndex(params);
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved USD-M Futures premium index${symbol ? ` for ${symbol}` : ' for all symbols'}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve USD-M Futures premium index: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
