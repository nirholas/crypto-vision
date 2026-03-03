// src/tools/binance-staking/ETH-staking-api/getWbethUnwrapHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stakingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetWbethUnwrapHistory(server: McpServer) {
    server.tool(
        "BinanceGetWbethUnwrapHistory",
        "Get WBETH Unwrap History API allows users to retrieve historical records of WBETH unwrap operations, including asset conversion details, exchange rates, and transaction status.",
        {
            startTime: z.number().int().optional().describe("Start time in milliseconds (optional)"),
            endTime: z.number().int().optional().describe("End time in milliseconds (optional)"),
            current: z
                .number()
                .int()
                .min(1)
                .default(1)
                .optional()
                .describe("Currently querying page. Start from 1. Default: 1"),
            size: z
                .number()
                .int()
                .min(1)
                .max(100)
                .default(10)
                .optional()
                .describe("Number of results per page. Default: 10, Max: 100"),
            recvWindow: z.number().int().optional().describe("Time window for request validity (in milliseconds)")
        },
        async (params) => {
            try {
                const response = await stakingClient.restAPI.getWbethUnwrapHistory({
                    ...(params.startTime !== undefined && { startTime: params.startTime }),
                    ...(params.endTime !== undefined && { endTime: params.endTime }),
                    ...(params.current !== undefined && { current: params.current }),
                    ...(params.size !== undefined && { size: params.size }),
                    ...(params.recvWindow !== undefined && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved historical records of WBETH unwrap operations. Response: ${JSON.stringify(
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
                            text: `Failed to retrieve historical records of WBETH unwrap operations. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
