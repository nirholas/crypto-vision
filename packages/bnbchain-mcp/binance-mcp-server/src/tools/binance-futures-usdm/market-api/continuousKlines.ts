/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/market-api/continuousKlines.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesContinuousKlines(server: McpServer) {
    server.tool(
        "BinanceFuturesContinuousKlines",
        "Get continuous contract kline data for USD-M Futures.",
        {
            pair: z.string().describe("Underlying pair (e.g., BTCUSDT)"),
            contractType: z.enum(["PERPETUAL", "CURRENT_MONTH", "NEXT_MONTH", "CURRENT_QUARTER", "NEXT_QUARTER"])
                .describe("Contract type"),
            interval: z.enum([
                "1m", "3m", "5m", "15m", "30m", 
                "1h", "2h", "4h", "6h", "8h", "12h",
                "1d", "3d", "1w", "1M"
            ]).describe("Kline interval"),
            startTime: z.number().int().optional().describe("Start timestamp in ms"),
            endTime: z.number().int().optional().describe("End timestamp in ms"),
            limit: z.number().int().optional().describe("Number of klines. Default 500, max 1500")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.continuousKlines({
                    pair: params.pair,
                    contractType: params.contractType,
                    interval: params.interval,
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Continuous Klines for ${params.pair} ${params.contractType}: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get continuous klines: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
