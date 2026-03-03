/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-pay/pay-api/getPayTradeHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { payClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetPayTradeHistory(server: McpServer) {
    server.tool(
        "BinanceGetPayTradeHistory",
        "Retrieve Binance Pay trade history using GET to fetch transaction records such as C2C transfers, merchant payments, crypto box activity, refunds, payouts, and remittance details.",
        {
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            limit: z
                .number()
                .int()
                .max(100, "Limit cannot be greater than 100")
                .default(100)
                .describe("Number of records to return, default 100, max 100"),
            recvWindow: z.number().int().optional().describe("Optional time window for request validity")
        },
        async (params) => {
            try {
                const response = await payClient.restAPI.getPayTradeHistory({
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved Binance Pay trade history. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to retrieve Binance Pay trade history: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
