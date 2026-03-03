// src/tools/binance-staking/SOL-staking-api/claimBoostRewards.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stakingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceClaimBoostRewards(server: McpServer) {
    server.tool(
        "BinanceClaimBoostRewards",
        "Claim Boost Rewards API allows users to claim their Boost APR airdrop rewards for staking.",
        {
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await stakingClient.restAPI.claimBoostRewards({
                    ...(params.recvWindow !== undefined && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully claim Boost APR airdrop rewards for staking. Response: ${JSON.stringify(
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
                            text: `Failed to claim Boost APR airdrop rewards. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
