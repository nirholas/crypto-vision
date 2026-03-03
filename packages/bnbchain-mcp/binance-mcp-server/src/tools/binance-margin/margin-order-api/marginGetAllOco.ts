/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/margin-order-api/marginGetAllOco.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceMarginGetAllOco(server: McpServer) {
    server.tool(
        "BinanceMarginGetAllOco",
        "Query all OCO (One-Cancels-the-Other) orders in Margin account, both open and closed.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (mandatory for isolated margin)"),
            fromId: z.number().int().optional().describe("Order list ID to start from"),
            startTime: z.number().int().optional().describe("Start timestamp in ms"),
            endTime: z.number().int().optional().describe("End timestamp in ms"),
            limit: z.number().int().optional().describe("Number of results, default 500, max 1000"),
            isIsolated: z.enum(["TRUE", "FALSE"]).optional().describe("For isolated margin, default FALSE"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.queryMarginAccountsAllOco({
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.fromId !== undefined && { fromId: params.fromId }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.isIsolated && { isIsolated: params.isIsolated }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `All Margin OCO orders: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query all margin OCO orders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
