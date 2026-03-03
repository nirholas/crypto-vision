// src/tools/binance-margin/isolated-margin-api/isolatedMarginAccount.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceIsolatedMarginAccount(server: McpServer) {
    server.tool(
        "BinanceIsolatedMarginAccount",
        "Query isolated margin account info including balances, margin level, and liquidation price for all symbols or a specific symbol.",
        {
            symbols: z.string().optional().describe("Comma-separated symbol list (e.g., BTCUSDT,ETHUSDT), max 5 symbols"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.getIsolatedAccount({
                    ...(params.symbols && { symbols: params.symbols }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Isolated Margin Account Info: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query account: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
