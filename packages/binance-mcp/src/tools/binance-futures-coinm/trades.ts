// src/tools/binance-futures-coinm/trades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deliveryClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesCOINMTrades(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMTrades",
        "Get recent trades for a specific COIN-M Futures trading pair.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSD_PERP)"),
            limit: z.number().optional().describe("Number of trades to return. Default 500; max 1000")
        },
        async ({ symbol, limit }) => {
            try {
                const params: any = { symbol };
                if (limit !== undefined) params.limit = limit;

                const data = await deliveryClient.trades(params);
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved ${data.length || 0} recent trades for COIN-M Futures ${symbol}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve COIN-M Futures recent trades: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
