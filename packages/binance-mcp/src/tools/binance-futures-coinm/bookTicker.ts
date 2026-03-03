// src/tools/binance-futures-coinm/bookTicker.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deliveryClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesCOINMBookTicker(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMBookTicker",
        "Get best price/qty on the order book for a symbol or symbols for COIN-M Futures.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (e.g., BTCUSD_PERP). If not provided, returns all symbols"),
            pair: z.string().optional().describe("Trading pair (e.g., BTCUSD)")
        },
        async ({ symbol, pair }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;
                if (pair) params.pair = pair;

                const data = await deliveryClient.tickerBookTicker(params);
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved COIN-M Futures book ticker${symbol ? ` for ${symbol}` : pair ? ` for pair ${pair}` : ' for all symbols'}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve COIN-M Futures book ticker: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
