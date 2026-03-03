// src/tools/binance-margin/cross-margin-api/crossMarginCancelAllOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginCancelAllOrders(server: McpServer) {
    server.tool(
        "BinanceCrossMarginCancelAllOrders",
        "Cancel all open margin orders for a specific trading pair. This will cancel all open orders on the symbol.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., BTCUSDT)"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.cancelAllOpenOrders({
                    symbol: params.symbol,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `All open margin orders cancelled for ${params.symbol}: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to cancel all orders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
