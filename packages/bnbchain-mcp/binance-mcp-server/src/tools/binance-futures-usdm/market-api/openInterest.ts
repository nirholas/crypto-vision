/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/market-api/openInterest.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesOpenInterest(server: McpServer) {
    server.tool(
        "BinanceFuturesOpenInterest",
        "Get current open interest for USD-M Futures symbol.",
        {
            symbol: z.string().describe("Futures symbol (e.g., BTCUSDT)")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.openInterest({
                    symbol: params.symbol
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Open interest for ${params.symbol}: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get open interest: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
