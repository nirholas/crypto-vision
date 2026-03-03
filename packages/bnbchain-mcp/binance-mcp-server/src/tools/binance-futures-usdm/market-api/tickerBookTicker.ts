/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/market-api/tickerBookTicker.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesTickerBookTicker(server: McpServer) {
    server.tool(
        "BinanceFuturesTickerBookTicker",
        "Get best price/qty on the order book for USD-M Futures symbol(s).",
        {
            symbol: z.string().optional().describe("Futures symbol (e.g., BTCUSDT). If not provided, returns all symbols")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.tickerBookTicker({
                    ...(params.symbol && { symbol: params.symbol })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Book ticker${params.symbol ? ` for ${params.symbol}` : ''}: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get book ticker: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
