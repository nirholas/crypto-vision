/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/isolated-margin-api/isolatedMarginTransfer.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceIsolatedMarginTransfer(server: McpServer) {
    server.tool(
        "BinanceIsolatedMarginTransfer",
        "Transfer assets to/from isolated margin account.",
        {
            asset: z.string().describe("Asset to transfer (e.g., BTC, USDT)"),
            symbol: z.string().describe("Isolated margin symbol (e.g., BTCUSDT)"),
            transFrom: z.enum(["SPOT", "ISOLATED_MARGIN"]).describe("Transfer from"),
            transTo: z.enum(["SPOT", "ISOLATED_MARGIN"]).describe("Transfer to"),
            amount: z.number().positive().describe("Amount to transfer"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.isolatedMarginAccountTransfer({
                    asset: params.asset,
                    symbol: params.symbol,
                    transFrom: params.transFrom,
                    transTo: params.transTo,
                    amount: params.amount,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Transfer successful: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to transfer: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
