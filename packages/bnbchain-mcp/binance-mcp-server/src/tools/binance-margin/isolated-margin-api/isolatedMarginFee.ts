/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/isolated-margin-api/isolatedMarginFee.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceIsolatedMarginFee(server: McpServer) {
    server.tool(
        "BinanceIsolatedMarginFee",
        "Query isolated margin fee data for all symbols or a specific symbol.",
        {
            vipLevel: z.number().int().optional().describe("VIP level for fee tier"),
            symbol: z.string().optional().describe("Specific symbol to query"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.queryIsolatedMarginFeeData({
                    ...(params.vipLevel !== undefined && { vipLevel: params.vipLevel }),
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Isolated Margin Fee Data: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query margin fee: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
