/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/market-api/depth.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesDepth(server: McpServer) {
    server.tool(
        "BinanceFuturesDepth",
        "Get order book depth data for a USD-M Futures symbol.",
        {
            symbol: z.string().describe("Futures symbol (e.g., BTCUSDT)"),
            limit: z.number().int().optional().describe("Depth limit: 5, 10, 20, 50, 100, 500, 1000. Default 500")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.depth({
                    symbol: params.symbol,
                    ...(params.limit && { limit: params.limit })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Futures Order Book for ${params.symbol}: Bids: ${data.bids?.length || 0}, Asks: ${data.asks?.length || 0}. ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get depth: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
