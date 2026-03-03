// src/tools/binance-spot/market-api/aggTrades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spotClient } from "../../../config/binanceClient.js";

export function registerBinanceAggTrades(server: McpServer) {
    server.tool(
        "BinanceAggTrades",
        "Get compressed, aggregate trades for a specific trading pair.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            fromId: z.number().optional().describe("ID to get aggregate trades from"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            limit: z.number().optional().describe("Default 500; max 1000")
        },
        async ({ symbol, fromId, startTime, endTime, limit }) => {
            try {
                const params: any = { symbol };
                
                if (fromId !== undefined) params.fromId = fromId;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (limit !== undefined) params.limit = limit;
                
                const response = await spotClient.restAPI.aggTrades(params);


                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved aggregate trades for ${symbol}. Total trades: ${data.length}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve aggregate trades: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}