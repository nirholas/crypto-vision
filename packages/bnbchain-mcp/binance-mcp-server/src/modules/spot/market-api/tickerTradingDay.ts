/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-spot/market-api/tickerTradingDay.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spotClient } from "../../../config/binanceClient.js";

export function registerBinanceTickerTradingDay(server: McpServer) {
    server.tool(
        "BinanceTickerTradingDay",
        "Get statistics for the current trading day for a symbol or all symbols.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (e.g., BTCUSDT)")
        },
        async ({ symbol }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;
                
                const response = await spotClient.restAPI.tickerTradingDay(params);


                const data = await response.data();

                const isArray = Array.isArray(data);
                const responseText = isArray
                    ? `Retrieved trading day statistics for all symbols. Total items: ${data.length}.`
                    : `Retrieved trading day statistics for ${symbol}.`;

                return {
                    content: [
                        {
                            type: "text",
                            text: `${responseText} Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve trading day statistics: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}