// src/tools/binance-futures-usdm/adlQuantile.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMADLQuantile(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMADLQuantile",
        "Get position ADL (Auto-Deleveraging) quantile estimate for USD-M Futures.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (e.g., BTCUSDT). If not provided, returns all positions")
        },
        async ({ symbol }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;

                const data = await futuresClient.adlQuantile(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved USD-M Futures ADL quantile${symbol ? ` for ${symbol}` : ' for all positions'}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve USD-M Futures ADL quantile: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
