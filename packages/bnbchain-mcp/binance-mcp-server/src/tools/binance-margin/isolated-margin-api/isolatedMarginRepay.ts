/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/isolated-margin-api/isolatedMarginRepay.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceIsolatedMarginRepay(server: McpServer) {
    server.tool(
        "BinanceIsolatedMarginRepay",
        "Repay borrowed assets in isolated margin account.",
        {
            asset: z.string().describe("Asset to repay (e.g., BTC, USDT)"),
            symbol: z.string().describe("Isolated margin symbol (e.g., BTCUSDT)"),
            amount: z.string().describe("Amount to repay"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.marginBorrowRepay({
                    asset: params.asset,
                    isIsolated: "TRUE",
                    symbol: params.symbol,
                    amount: params.amount,
                    type: "REPAY",
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Repaid ${params.amount} ${params.asset} for ${params.symbol}: ${JSON.stringify(data)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to repay: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
