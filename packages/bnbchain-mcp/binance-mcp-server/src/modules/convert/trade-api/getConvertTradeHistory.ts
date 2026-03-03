/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-convert/trade-api/getConvertTradeHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { convertClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetConvertTradeHistory(server: McpServer) {
    server.tool(
        "BinanceGetConvertTradeHistory",
        "The API retrieves your token conversion trade history within a specified time range, with support for pagination using the limit parameter (up to 1000 records).",
        {
            startTime: z.number().int().describe("Start time in milliseconds"),
            endTime: z.number().int().describe("End time in milliseconds"),
            limit: z
                .number()
                .int()
                .max(1000, "Limit cannot be greater than 1000")
                .optional()
                .describe("Default 100, Max 1000"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await convertClient.restAPI.getConvertTradeHistory({
                    startTime: params.startTime,
                    endTime: params.endTime,
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved your token conversion trade history. Response: ${JSON.stringify(
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
                            text: `Failed to retrieve your token conversion: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
