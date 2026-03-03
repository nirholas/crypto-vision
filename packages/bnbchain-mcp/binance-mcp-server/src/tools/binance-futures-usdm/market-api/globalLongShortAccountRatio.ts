/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/market-api/globalLongShortAccountRatio.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesGlobalLongShortAccountRatio(server: McpServer) {
    server.tool(
        "BinanceFuturesGlobalLongShortAccountRatio",
        "Get global long/short account ratio for USD-M Futures.",
        {
            symbol: z.string().describe("Futures symbol (e.g., BTCUSDT)"),
            period: z.enum(["5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d"]).describe("Data period"),
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            limit: z.number().int().max(500).optional().describe("Number of records. Default 30, max 500")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.globalLongShortAccountRatio({
                    symbol: params.symbol,
                    period: params.period,
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Global long/short account ratio for ${params.symbol} (${params.period}): ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get global long/short account ratio: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
