/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-staking/SOL-staking-api/getUnclaimedRewards.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stakingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetUnclaimedRewards(server: McpServer) {
    server.tool(
        "BinanceGetUnclaimedRewards",
        "Get Unclaimed Rewards API allows users to retrieve information about unclaimed rewards from their SOL staking activities.",
        {
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await stakingClient.restAPI.getUnclaimedRewards({
                    ...(params.recvWindow !== undefined && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved information about unclaimed rewards. Response: ${JSON.stringify(
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
                            text: `Failed to retrieve information about unclaimed rewards. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
