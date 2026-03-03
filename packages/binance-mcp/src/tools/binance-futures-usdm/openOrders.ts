// src/tools/binance-futures-usdm/openOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMOpenOrders(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMOpenOrders",
        "Get all current open orders for USD-M Futures.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (e.g., BTCUSDT). If not provided, returns all open orders")
        },
        async ({ symbol }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;

                const data = await futuresClient.openOrders(params);
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved USD-M Futures open orders${symbol ? ` for ${symbol}` : ''}. Count: ${data.length || 0}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve USD-M Futures open orders: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
