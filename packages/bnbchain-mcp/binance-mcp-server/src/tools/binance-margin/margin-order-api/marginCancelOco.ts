/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/margin-order-api/marginCancelOco.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceMarginCancelOco(server: McpServer) {
    server.tool(
        "BinanceMarginCancelOco",
        "Cancel an entire OCO (One-Cancels-the-Other) order in Margin account. Both legs will be cancelled.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            orderListId: z.number().int().optional().describe("Order list ID"),
            listClientOrderId: z.string().optional().describe("Client order list ID"),
            newClientOrderId: z.string().optional().describe("New client order ID for this cancel request"),
            isIsolated: z.enum(["TRUE", "FALSE"]).optional().describe("For isolated margin, default FALSE"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                // Either orderListId or listClientOrderId must be provided
                if (params.orderListId === undefined && !params.listClientOrderId) {
                    return {
                        content: [{ type: "text", text: "Either orderListId or listClientOrderId must be provided" }],
                        isError: true
                    };
                }

                const response = await marginClient.restAPI.marginAccountCancelOco({
                    symbol: params.symbol,
                    ...(params.orderListId !== undefined && { orderListId: params.orderListId }),
                    ...(params.listClientOrderId && { listClientOrderId: params.listClientOrderId }),
                    ...(params.newClientOrderId && { newClientOrderId: params.newClientOrderId }),
                    ...(params.isIsolated && { isIsolated: params.isIsolated }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Margin OCO order cancelled successfully: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to cancel margin OCO order: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
