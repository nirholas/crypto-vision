// src/tools/binance-futures-coinm/userTrades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deliveryClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesCOINMUserTrades(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMUserTrades",
        "Get account trade list for COIN-M Futures.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (e.g., BTCUSD_PERP)"),
            pair: z.string().optional().describe("Trading pair (e.g., BTCUSD)"),
            orderId: z.number().optional().describe("Filter by order ID"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            fromId: z.number().optional().describe("Trade ID to start from"),
            limit: z.number().optional().describe("Default 500; max 1000")
        },
        async ({ symbol, pair, orderId, startTime, endTime, fromId, limit }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;
                if (pair) params.pair = pair;
                if (orderId !== undefined) params.orderId = orderId;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (fromId !== undefined) params.fromId = fromId;
                if (limit !== undefined) params.limit = limit;

                const data = await deliveryClient.userTrades(params);
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved ${data.length || 0} COIN-M Futures trades. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve COIN-M Futures user trades: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}

