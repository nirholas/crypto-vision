/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-sub-account/transfer-api/universalTransfer.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spotClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceSubAccountUniversalTransfer(server: McpServer) {
    server.tool(
        "BinanceSubAccountUniversalTransfer",
        "Universal transfer between master account and sub-accounts, supporting various account types (spot, margin, futures, etc.).",
        {
            fromEmail: z.string().email().optional()
                .describe("Sender email (leave empty for master account)"),
            toEmail: z.string().email().optional()
                .describe("Recipient email (leave empty for master account)"),
            fromAccountType: z.enum(["SPOT", "USDT_FUTURE", "COIN_FUTURE", "MARGIN", "ISOLATED_MARGIN"])
                .describe("Source account type"),
            toAccountType: z.enum(["SPOT", "USDT_FUTURE", "COIN_FUTURE", "MARGIN", "ISOLATED_MARGIN"])
                .describe("Destination account type"),
            clientTranId: z.string().optional()
                .describe("Client transfer ID for idempotency"),
            symbol: z.string().optional()
                .describe("Required for isolated margin transfers"),
            asset: z.string()
                .describe("Asset to transfer (e.g., 'BTC', 'USDT')"),
            amount: z.number().positive()
                .describe("Amount to transfer"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await spotClient.restAPI.universalTransfer({
                    fromAccountType: params.fromAccountType,
                    toAccountType: params.toAccountType,
                    asset: params.asset,
                    amount: params.amount,
                    ...(params.fromEmail && { fromEmail: params.fromEmail }),
                    ...(params.toEmail && { toEmail: params.toEmail }),
                    ...(params.clientTranId && { clientTranId: params.clientTranId }),
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `✅ Universal transfer successful!\n\nFrom: ${params.fromEmail || 'Master'} (${params.fromAccountType})\nTo: ${params.toEmail || 'Master'} (${params.toAccountType})\nAsset: ${params.asset}\nAmount: ${params.amount}\n\nTransaction: ${JSON.stringify(data, null, 2)}`
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
