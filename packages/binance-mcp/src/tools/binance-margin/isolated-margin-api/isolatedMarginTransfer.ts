// src/tools/binance-margin/isolated-margin-api/isolatedMarginTransfer.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceIsolatedMarginTransfer(server: McpServer) {
    server.tool(
        "BinanceIsolatedMarginTransfer",
        "Transfer assets between spot wallet and isolated margin account for a specific symbol.",
        {
            asset: z.string().describe("Asset to transfer (e.g., BTC, USDT)"),
            symbol: z.string().describe("Isolated margin symbol (e.g., BTCUSDT)"),
            amount: z.string().describe("Amount to transfer"),
            transFrom: z.enum(["SPOT", "ISOLATED_MARGIN"]).describe("Transfer from account type"),
            transTo: z.enum(["SPOT", "ISOLATED_MARGIN"]).describe("Transfer to account type"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.transfer({
                    asset: params.asset,
                    symbol: params.symbol,
                    amount: params.amount,
                    transFrom: params.transFrom,
                    transTo: params.transTo,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Isolated margin transfer successful: ${JSON.stringify(data, null, 2)}`
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
