// src/tools/binance-options/historyOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsHistoryOrders(server: McpServer) {
    server.tool(
        "BinanceOptionsHistoryOrders",
        "Get historical options orders.",
        {
            symbol: z.string().describe("Option trading symbol (e.g., BTC-240126-42000-C)"),
            orderId: z.number().optional().describe("Order ID to fetch from"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            limit: z.number().optional().describe("Number of orders to return. Default 100; max 1000.")
        },
        async ({ symbol, orderId, startTime, endTime, limit }) => {
            try {
                const params: any = { symbol };
                if (orderId !== undefined) params.orderId = orderId;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (limit !== undefined) params.limit = limit;
                
                const data = await optionsClient.historyOrders(params);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Historical orders retrieved. Count: ${Array.isArray(data) ? data.length : 0}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get history orders: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
