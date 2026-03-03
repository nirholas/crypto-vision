// src/tools/binance-futures-coinm/cancelOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesCOINMCancelOrder(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMCancelOrder",
        "Cancel a COIN-M futures order.",
        {
            symbol: z.string().describe("Trading symbol"),
            orderId: z.number().int().optional().describe("Order ID"),
            origClientOrderId: z.string().optional().describe("Original client order ID"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await deliveryClient.cancelOrder({
                    symbol: params.symbol,
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.origClientOrderId && { origClientOrderId: params.origClientOrderId }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                return {
                    content: [{ type: "text", text: `COIN-M order cancelled: ${JSON.stringify(data)}` }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to cancel COIN-M order: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
