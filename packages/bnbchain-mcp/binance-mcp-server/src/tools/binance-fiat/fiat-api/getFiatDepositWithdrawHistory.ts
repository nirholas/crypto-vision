/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-fiat/fiat-api/getFiatDepositWithdrawHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fiatClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetFiatDepositWithdrawHistory(server: McpServer) {
    server.tool(
        "BinanceGetFiatDepositWithdrawHistory",
        "Fetches fiat deposit or withdrawal history, showing transaction details like amount, currency, method, status, and timestamps.",
        {
            transactionType: z.enum(["0", "1"]).describe("Transaction type: 0 for deposit, 1 for withdraw"),
            beginTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            page: z.number().int().optional().describe("Page number, default is 1"),
            rows: z
                .number()
                .int()
                .max(500, "Rows cannot be greater than 500")
                .optional()
                .describe("Number of records per page, default 100, max 500"),
            recvWindow: z.number().int().optional().describe("Optional time window for request validity")
        },
        async (params) => {
            try {
                const response = await fiatClient.restAPI.getFiatDepositWithdrawHistory({
                    transactionType: params.transactionType,
                    ...(params.beginTime && { beginTime: params.beginTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.page && { page: params.page }),
                    ...(params.rows && { rows: params.rows }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully fetched fiat deposit or withdrawal history. Response: ${JSON.stringify(
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
                            text: `Failed to fetches fiat deposit or withdrawal history: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
