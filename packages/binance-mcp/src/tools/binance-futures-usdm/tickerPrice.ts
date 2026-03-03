// src/tools/binance-futures-usdm/tickerPrice.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMTickerPrice(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMTickerPrice",
        "Get latest price for a symbol or symbols for USD-M Futures.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (e.g., BTCUSDT). If not provided, returns all symbols")
        },
        async ({ symbol }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;

                const data = await futuresClient.tickerPrice(params);
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved USD-M Futures ticker price${symbol ? ` for ${symbol}` : ' for all symbols'}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve USD-M Futures ticker price: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
