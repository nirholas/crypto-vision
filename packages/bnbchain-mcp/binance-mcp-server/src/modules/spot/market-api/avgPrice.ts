/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-spot/market-api/avgPrice.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spotClient } from "../../../config/binanceClient.js";

export function registerBinanceAvgPrice(server: McpServer) {
    server.tool(
        "BinanceAvgPrice",
        "Get current average price for a trading pair.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)")
        },
        async ({ symbol }) => {
            try {
                const response = await spotClient.restAPI.avgPrice({
                    symbol: symbol
                });


                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved current average price for ${symbol}. Average price: ${data.price}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve average price: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}