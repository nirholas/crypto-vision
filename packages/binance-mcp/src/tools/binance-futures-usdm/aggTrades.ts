// src/tools/binance-futures-usdm/aggTrades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMAggTrades(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMAggTrades",
        "Get compressed, aggregate trades for a specific USD-M Futures trading pair.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            fromId: z.number().optional().describe("ID to get aggregate trades from INCLUSIVE"),
            startTime: z.number().optional().describe("Timestamp in ms to get aggregate trades from INCLUSIVE"),
            endTime: z.number().optional().describe("Timestamp in ms to get aggregate trades until INCLUSIVE"),
            limit: z.number().optional().describe("Default 500; max 1000")
        },
        async ({ symbol, fromId, startTime, endTime, limit }) => {
            try {
                const params: any = { symbol };
                if (fromId !== undefined) params.fromId = fromId;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (limit !== undefined) params.limit = limit;

                const data = await futuresClient.aggTrades(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved ${data.length || 0} aggregated trades for USD-M Futures ${symbol}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve USD-M Futures aggregated trades: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
