// src/tools/binance-spot/trade-api/getOpenOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spotClient } from "../../../config/binanceClient.js";

export function registerBinanceGetOpenOrders(server: McpServer) {
    server.tool(
        "BinanceGetOpenOrders",
        "Get all open orders on Binance for a specific symbol or all symbols.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (e.g., BTCUSDT)")
        },
        async ({ symbol }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;
                
                const response = await spotClient.restAPI.getOpenOrders(params);

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved open orders${symbol ? ` for ${symbol}` : ''}. Total open orders: ${data.length}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve open orders: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}