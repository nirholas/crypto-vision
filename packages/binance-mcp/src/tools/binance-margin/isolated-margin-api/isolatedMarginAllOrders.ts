// src/tools/binance-margin/isolated-margin-api/isolatedMarginAllOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceIsolatedMarginAllOrders(server: McpServer) {
    server.tool(
        "BinanceIsolatedMarginAllOrders",
        "Query all orders (open and filled/cancelled) in isolated margin account for a specific symbol.",
        {
            symbol: z.string().describe("Isolated margin symbol (e.g., BTCUSDT)"),
            orderId: z.number().int().optional().describe("Order ID to start from"),
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            limit: z.number().int().optional().describe("Number of results (default 500, max 500)"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.getAllOrders({
                    symbol: params.symbol,
                    isIsolated: "TRUE",
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `All Isolated Margin Orders for ${params.symbol}: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query all orders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
