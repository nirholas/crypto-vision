/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/market-api/fundingRate.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesFundingRate(server: McpServer) {
    server.tool(
        "BinanceFuturesFundingRate",
        "Get funding rate history for USD-M Futures.",
        {
            symbol: z.string().describe("Futures symbol (e.g., BTCUSDT)"),
            startTime: z.number().int().optional().describe("Start timestamp in ms"),
            endTime: z.number().int().optional().describe("End timestamp in ms"),
            limit: z.number().int().optional().describe("Number of results. Default 100, max 1000")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.fundingRate({
                    symbol: params.symbol,
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Funding Rate History for ${params.symbol}: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get funding rate: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
