// src/tools/binance-futures-usdm/userTrades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMUserTrades(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMUserTrades",
        "Get account trade list for USD-M Futures.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            orderId: z.number().optional().describe("Filter by order ID"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            fromId: z.number().optional().describe("Trade ID to start from"),
            limit: z.number().optional().describe("Default 500; max 1000")
        },
        async ({ symbol, orderId, startTime, endTime, fromId, limit }) => {
            try {
                const params: any = { symbol };
                if (orderId !== undefined) params.orderId = orderId;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (fromId !== undefined) params.fromId = fromId;
                if (limit !== undefined) params.limit = limit;

                const data = await futuresClient.userTrades(params);
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved ${data.length || 0} USD-M Futures trades for ${symbol}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve USD-M Futures user trades: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
