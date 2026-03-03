// src/tools/binance-futures-coinm/ticker24hr.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deliveryClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesCOINMTicker24hr(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMTicker24hr",
        "Get 24-hour rolling window price change statistics for COIN-M Futures.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (e.g., BTCUSD_PERP). If not provided, returns all symbols"),
            pair: z.string().optional().describe("Trading pair (e.g., BTCUSD)")
        },
        async ({ symbol, pair }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;
                if (pair) params.pair = pair;

                const data = await deliveryClient.ticker24hr(params);
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved COIN-M Futures 24hr ticker${symbol ? ` for ${symbol}` : pair ? ` for pair ${pair}` : ' for all symbols'}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve COIN-M Futures 24hr ticker: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
