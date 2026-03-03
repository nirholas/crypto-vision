// src/tools/binance-spot/trade-api/allOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spotClient } from "../../../config/binanceClient.js";

export function registerBinanceAllOrders(server: McpServer) {
    server.tool(
        "BinanceAllOrders",
        "Get all account orders for a specific symbol; active, canceled, or filled.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            orderId: z.number().optional().describe("Order ID to start from"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            limit: z.number().optional().describe("Maximum number of orders to return (default 500, max 1000)")
        },
        async ({ symbol, orderId, startTime, endTime, limit }) => {
            try {
                const params: any = { symbol };
                
                if (orderId !== undefined) params.orderId = orderId;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (limit !== undefined) params.limit = limit;
                
                const response = await spotClient.restAPI.allOrders(params);

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved all orders for ${symbol}. Total orders: ${data.length}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve all orders: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}