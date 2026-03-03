// src/tools/binance-futures-coinm/aggTrades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deliveryClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesCOINMAggTrades(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMAggTrades",
        "Get compressed, aggregate trades for a specific COIN-M Futures trading pair.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSD_PERP)"),
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

                const data = await deliveryClient.aggTrades(params);
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved ${data.length || 0} aggregated trades for COIN-M Futures ${symbol}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve COIN-M Futures aggregated trades: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
