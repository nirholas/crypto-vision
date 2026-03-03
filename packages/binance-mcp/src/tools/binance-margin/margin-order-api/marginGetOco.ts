/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-margin/margin-order-api/marginGetOco.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceMarginGetOco(server: McpServer) {
    server.tool(
        "BinanceMarginGetOco",
        "Query a specific OCO (One-Cancels-the-Other) order in Margin account by orderListId or listClientOrderId.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (mandatory for isolated margin)"),
            orderListId: z.number().int().optional().describe("Order list ID"),
            origClientOrderId: z.string().optional().describe("Original client order list ID"),
            isIsolated: z.enum(["TRUE", "FALSE"]).optional().describe("For isolated margin, default FALSE"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                // Either orderListId or origClientOrderId must be provided
                if (params.orderListId === undefined && !params.origClientOrderId) {
                    return {
                        content: [{ type: "text", text: "Either orderListId or origClientOrderId must be provided" }],
                        isError: true
                    };
                }

                const response = await marginClient.restAPI.queryMarginAccountsOco({
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.orderListId !== undefined && { orderListId: params.orderListId }),
                    ...(params.origClientOrderId && { origClientOrderId: params.origClientOrderId }),
                    ...(params.isIsolated && { isIsolated: params.isIsolated }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Margin OCO order details: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query margin OCO order: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
