/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-margin/isolated-margin-api/isolatedMarginBorrow.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceIsolatedMarginBorrow(server: McpServer) {
    server.tool(
        "BinanceIsolatedMarginBorrow",
        "Borrow assets in isolated margin account for a specific symbol.",
        {
            asset: z.string().describe("Asset to borrow (e.g., BTC, USDT)"),
            symbol: z.string().describe("Isolated margin symbol (e.g., BTCUSDT)"),
            amount: z.string().describe("Amount to borrow"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.marginBorrowRepay({
                    asset: params.asset,
                    isIsolated: "TRUE",
                    symbol: params.symbol,
                    amount: params.amount,
                    type: "BORROW",
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Borrowed ${params.amount} ${params.asset} for ${params.symbol}: ${JSON.stringify(data)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to borrow: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
