/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-convert/trade-api/sendQuoteRequest.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { convertClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceConvertSendQuoteRequest(server: McpServer) {
    server.tool(
        "BinanceConvertSendQuoteRequest",
        "Get a real-time quote to convert one token to another, including rate and amount, if you have enough funds.",
        {
            fromAsset: z.string().describe("Asset you will spend (required)"),
            toAsset: z.string().describe("Asset you will receive (required)"),
            fromAmount: z.number().positive().optional().describe("Amount to be debited after conversion"),
            toAmount: z.number().positive().optional().describe("Amount to be credited after conversion"),
            walletType: z.enum(["SPOT", "FUNDING"]).optional().describe("SPOT or FUNDING. Default is SPOT"),
            validTime: z
                .enum(["10s", "30s", "1m"])
                .optional()
                .describe("Quote validity duration: 10s, 30s, 1m; default is 10s"),
            recvWindow: z
                .number()
                .int()
                .max(60000, "recvWindow cannot be greater than 60000")
                .optional()
                .describe("The value cannot be greater than 60000")
        },
        async (params) => {
            try {
                const response = await convertClient.restAPI.sendQuoteRequest({
                    fromAsset: params.fromAsset,
                    toAsset: params.toAsset,
                    ...(params.fromAmount && { fromAmount: params.fromAmount }),
                    ...(params.toAmount && { toAmount: params.toAmount }),
                    ...(params.walletType && { walletType: params.walletType }),
                    ...(params.validTime && { validTime: params.validTime }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved real-time quote to convert one token to another. Response: ${JSON.stringify(
                                data
                            )}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to get a real-time quote to convert: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
