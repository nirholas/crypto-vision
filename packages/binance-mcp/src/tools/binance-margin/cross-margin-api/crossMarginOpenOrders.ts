// src/tools/binance-margin/cross-margin-api/crossMarginOpenOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginOpenOrders(server: McpServer) {
    server.tool(
        "BinanceCrossMarginOpenOrders",
        "Query all open margin orders. If symbol is provided, only orders for that symbol are returned.",
        {
            symbol: z.string().optional().describe("Trading pair symbol (e.g., BTCUSDT)"),
            isIsolated: z.enum(["TRUE", "FALSE"]).optional().describe("For isolated margin or not"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.getOpenOrders({
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.isIsolated && { isIsolated: params.isIsolated }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Open Margin Orders: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query open orders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
