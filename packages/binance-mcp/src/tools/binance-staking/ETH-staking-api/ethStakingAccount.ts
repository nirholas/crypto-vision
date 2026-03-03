// src/tools/binance-staking/ETH-staking-api/ethStakingAccount.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stakingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceEthStakingAccount(server: McpServer) {
    server.tool(
        "BinanceEthStakingAccount",
        "ETH Staking Account API allows users to retrieve their current ETH staking holdings and 30-day profit details, including amounts from WBETH and BETH",
        {
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await stakingClient.restAPI.ethStakingAccount({
                    ...(params.recvWindow !== undefined && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved current ETH staking holdings . Response: ${JSON.stringify(
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
                            text: `Failed to retrieve ETH staking holdings . ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
