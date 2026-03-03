// src/tools/binance-futures-coinm/cancelAllOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesCOINMCancelAllOrders(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMCancelAllOrders",
        "Cancel all open COIN-M futures orders for a symbol.",
        {
            symbol: z.string().describe("Trading symbol"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await deliveryClient.cancelAllOpenOrders({
                    symbol: params.symbol,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                return {
                    content: [{ type: "text", text: `All COIN-M orders cancelled: ${JSON.stringify(data)}` }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to cancel all COIN-M orders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
