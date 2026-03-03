/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/market-api/indexInfo.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesIndexInfo(server: McpServer) {
    server.tool(
        "BinanceFuturesIndexInfo",
        "Get composite index symbol information for USD-M Futures.",
        {
            symbol: z.string().optional().describe("Composite index symbol (e.g., DEFIUSDT)")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.indexInfo({
                    ...(params.symbol && { symbol: params.symbol })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Index info${params.symbol ? ` for ${params.symbol}` : ''}: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get index info: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
