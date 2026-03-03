/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/market-api/tickerPrice.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesTickerPrice(server: McpServer) {
    server.tool(
        "BinanceFuturesTickerPrice",
        "Get latest price for a USD-M Futures symbol or all symbols.",
        {
            symbol: z.string().optional().describe("Futures symbol. If omitted, returns all symbols")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.tickerPrice({
                    ...(params.symbol && { symbol: params.symbol })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Price Ticker: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get price ticker: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
