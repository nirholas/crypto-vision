// src/tools/binance-futures-usdm/bookTicker.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMBookTicker(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMBookTicker",
        "Get best price/qty on the order book for a symbol or symbols for USD-M Futures.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (e.g., BTCUSDT). If not provided, returns all symbols")
        },
        async ({ symbol }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;

                const data = await futuresClient.bookTicker(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved USD-M Futures book ticker${symbol ? ` for ${symbol}` : ' for all symbols'}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve USD-M Futures book ticker: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
