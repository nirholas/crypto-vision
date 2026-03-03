// src/tools/binance-staking/SOL-staking-api/solStakingAccount.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stakingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceSolStakingAccount(server: McpServer) {
    server.tool(
        "registerBinanceSolStakingAccount",
        "SOL Staking Account API allows users to view their SOL staking account details, including their current BNSOL holdings, equivalent SOL balance, and the profit in SOL over the past 30 days.",
        {
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await stakingClient.restAPI.solStakingAccount({
                    ...(params.recvWindow !== undefined && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieve SOL staking account details: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to retrieve SOL staking account details. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
