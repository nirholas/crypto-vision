/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-sub-account/transfer-api/futuresTransfer.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spotClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceSubAccountFuturesTransfer(server: McpServer) {
    server.tool(
        "BinanceSubAccountFuturesTransfer",
        "Internal transfer between sub-account futures accounts. Move assets between different sub-account futures wallets.",
        {
            fromEmail: z.string().email()
                .describe("Sender sub-account email"),
            toEmail: z.string().email()
                .describe("Recipient sub-account email"),
            futuresType: z.enum(["1", "2"])
                .describe("Futures type: 1 for USD-M, 2 for COIN-M"),
            asset: z.string()
                .describe("Asset to transfer (e.g., 'USDT', 'BTC')"),
            amount: z.number().positive()
                .describe("Amount to transfer"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await spotClient.restAPI.subAccountFuturesInternalTransfer({
                    fromEmail: params.fromEmail,
                    toEmail: params.toEmail,
                    futuresType: params.futuresType,
                    asset: params.asset,
                    amount: params.amount,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `✅ Futures internal transfer successful!\n\nFrom: ${params.fromEmail}\nTo: ${params.toEmail}\nFutures Type: ${params.futuresType === "1" ? "USD-M" : "COIN-M"}\nAsset: ${params.asset}\nAmount: ${params.amount}\n\nTransaction: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to transfer: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
