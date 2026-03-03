// src/tools/binance-futures-coinm/openOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesCOINMOpenOrders(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMOpenOrders",
        "Get current COIN-M futures open orders.",
        {
            symbol: z.string().optional().describe("Trading symbol (optional)"),
            pair: z.string().optional().describe("Trading pair"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await deliveryClient.openOrders({
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.pair && { pair: params.pair }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                return {
                    content: [{ type: "text", text: `COIN-M open orders: ${JSON.stringify(data)}` }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get COIN-M open orders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
