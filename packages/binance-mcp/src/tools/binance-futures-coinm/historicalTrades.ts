// src/tools/binance-futures-coinm/historicalTrades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deliveryClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesCOINMHistoricalTrades(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMHistoricalTrades",
        "Get older market historical trades for a specific COIN-M Futures trading pair.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSD_PERP)"),
            limit: z.number().optional().describe("Number of trades to return. Default 500; max 1000"),
            fromId: z.number().optional().describe("Trade ID to fetch from. Default gets most recent trades")
        },
        async ({ symbol, limit, fromId }) => {
            try {
                const params: any = { symbol };
                if (limit !== undefined) params.limit = limit;
                if (fromId !== undefined) params.fromId = fromId;

                const data = await deliveryClient.historicalTrades(params);
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved ${data.length || 0} historical trades for COIN-M Futures ${symbol}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve COIN-M Futures historical trades: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
