// src/tools/binance-staking/SOL-staking-api/getUnclaimedRewards.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stakingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceRedeemSol(server: McpServer) {
    server.tool(
        "registerBinanceRedeemSol",
        " Redeem SOL API allows users to redeem BNSOL and receive SOL in exchange. It enables the conversion of BNSOL tokens into SOL based on the specified amount",
        {
            amount: z.number().min(0).max(99999999).describe("Amount in BNSOL, limit to 8 decimals (mandatory)"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await stakingClient.restAPI.redeemSol({
                    amount: params.amount,
                    ...(params.recvWindow !== undefined && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully redeem BNSOL and receive SOL in exchange. Response: ${JSON.stringify(
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
                            text: `Failed to redeem BNSOL and receive SOL in exchange. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
