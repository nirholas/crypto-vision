// src/tools/binance-staking/ETH-staking-api/getCurrentEthStakingQuota.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stakingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetCurrentEthStakingQuota(server: McpServer) {
    server.tool(
        "BinanceGetCurrentEthStakingQuota",
        "Get Current ETH Staking Quota API allows users to retrieve their available ETH staking and redemption quotas, reflecting personal and daily limits.",
        {
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await stakingClient.restAPI.getCurrentEthStakingQuota({
                    ...(params.recvWindow !== undefined && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved current ETH Staking Quota API allows users. Response: ${JSON.stringify(
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
                            text: `Failed to retrieve current ETH Staking Quota API allows users. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
