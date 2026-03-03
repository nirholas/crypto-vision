// src/tools/binance-futures-usdm/ticker24hr.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMTicker24hr(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMTicker24hr",
        "Get 24-hour rolling window price change statistics for USD-M Futures.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (e.g., BTCUSDT). If not provided, returns all symbols")
        },
        async ({ symbol }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;

                const data = await futuresClient.ticker24hr(params);
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved USD-M Futures 24hr ticker${symbol ? ` for ${symbol}` : ' for all symbols'}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve USD-M Futures 24hr ticker: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
