/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/cross-margin-api/crossMarginCancelOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginCancelOrder(server: McpServer) {
    server.tool(
        "BinanceCrossMarginCancelOrder",
        "Cancel an active order in Cross Margin account.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            orderId: z.number().int().optional().describe("Order ID to cancel"),
            origClientOrderId: z.string().optional().describe("Original client order ID"),
            newClientOrderId: z.string().optional().describe("New client order ID for this cancel request"),
            isIsolated: z.enum(["TRUE", "FALSE"]).optional().describe("For isolated margin, default FALSE"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.marginAccountCancelOrder({
                    symbol: params.symbol,
                    ...(params.orderId !== undefined && { orderId: params.orderId }),
                    ...(params.origClientOrderId && { origClientOrderId: params.origClientOrderId }),
                    ...(params.newClientOrderId && { newClientOrderId: params.newClientOrderId }),
                    ...(params.isIsolated && { isIsolated: params.isIsolated }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Order cancelled successfully: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to cancel order: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
