/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/margin-order-api/marginGetOpenOco.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceMarginGetOpenOco(server: McpServer) {
    server.tool(
        "BinanceMarginGetOpenOco",
        "Query all open OCO (One-Cancels-the-Other) orders in Margin account.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (mandatory for isolated margin)"),
            isIsolated: z.enum(["TRUE", "FALSE"]).optional().describe("For isolated margin, default FALSE"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.queryMarginAccountsOpenOco({
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.isIsolated && { isIsolated: params.isIsolated }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Open Margin OCO orders: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query open margin OCO orders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
