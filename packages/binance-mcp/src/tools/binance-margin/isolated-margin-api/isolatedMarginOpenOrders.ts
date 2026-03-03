// src/tools/binance-margin/isolated-margin-api/isolatedMarginOpenOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceIsolatedMarginOpenOrders(server: McpServer) {
    server.tool(
        "BinanceIsolatedMarginOpenOrders",
        "Query all open orders in isolated margin account for a specific symbol.",
        {
            symbol: z.string().describe("Isolated margin symbol (e.g., BTCUSDT)"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.getOpenOrders({
                    symbol: params.symbol,
                    isIsolated: "TRUE",
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Isolated Margin Open Orders for ${params.symbol}: ${JSON.stringify(data, null, 2)}`
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
