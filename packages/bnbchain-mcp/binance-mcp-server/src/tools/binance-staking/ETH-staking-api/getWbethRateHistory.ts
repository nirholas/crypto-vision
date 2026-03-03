/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-staking/ETH-staking-api/getWbethRateHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stakingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetWbethRateHistory(server: McpServer) {
    server.tool(
        "BinanceGetWbethRateHistory",
        "Get WBETH Rate History API allows users to retrieve historical WBETH exchange rates and BETH annual percentage rates (APR) within a specified time range.",
        {
            startTime: z.number().int().optional().describe("Start time in milliseconds (optional)"),
            endTime: z.number().int().optional().describe("End time in milliseconds (optional)"),
            current: z
                .number()
                .int()
                .min(1)
                .default(1)
                .optional()
                .describe("Currently querying page. Starts from 1. Default: 1"),
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
                const response = await stakingClient.restAPI.getWbethRateHistory({
                    ...(params.recvWindow !== undefined && { recvWindow: params.recvWindow }),
                    ...(params.startTime !== undefined && { startTime: params.startTime }),
                    ...(params.endTime !== undefined && { endTime: params.endTime }),
                    ...(params.current !== undefined && { current: params.current }),
                    ...(params.size !== undefined && { size: params.size })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved historical WBETH exchange rates and BETH annual percentage rates. Response: ${JSON.stringify(
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
                            text: `Failed to retrieve historical WBETH exchange rates and BETH annual percentage rates. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
