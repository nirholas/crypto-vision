/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-staking/ETH-staking-api/getEthRedemptionHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stakingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetEthRedemptionHistory(server: McpServer) {
    server.tool(
        "BinanceGetEthRedemptionHistory",
        "Get ETH Redemption History API allows users to retrieve their historical ETH staking redemption records, including details like asset type, amount, status, and time of redemption.",
        {
            startTime: z.number().int().optional().describe("Start time in milliseconds (e.g., 1641522717552)"),
            endTime: z.number().int().optional().describe("End time in milliseconds (e.g., 1641522526562)"),
            current: z
                .number()
                .int()
                .min(1)
                .default(1)
                .optional()
                .describe("Currently querying page, start from 1. Default is 1"),
            size: z
                .number()
                .int()
                .min(1)
                .max(100)
                .default(10)
                .optional()
                .describe("Number of results per page, Default is 10, Max is 100"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await stakingClient.restAPI.getCurrentEthStakingQuota({
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
                            text: `Successfully retrieved history API allows users to retrieve their historical ETH staking redemption records. Response: ${JSON.stringify(
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
                            text: `Failed to retrieve history API allows users to retrieve their historical ETH staking redemption records. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
