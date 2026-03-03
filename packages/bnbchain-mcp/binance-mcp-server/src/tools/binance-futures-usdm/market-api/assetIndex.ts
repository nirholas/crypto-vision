/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/market-api/assetIndex.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesAssetIndex(server: McpServer) {
    server.tool(
        "BinanceFuturesAssetIndex",
        "Get asset index for Multi-Asset margin mode.",
        {
            symbol: z.string().optional().describe("Symbol (e.g., BTCUSD)")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.assetIndex({
                    ...(params.symbol && { symbol: params.symbol })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Asset index${params.symbol ? ` for ${params.symbol}` : ''}: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get asset index: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
