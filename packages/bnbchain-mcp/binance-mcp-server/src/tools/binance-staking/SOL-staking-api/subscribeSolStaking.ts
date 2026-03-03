/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-staking/SOL-staking-api/subscribeSolStaking.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stakingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceSubscribeSolStaking(server: McpServer) {
    server.tool(
        "BinanceSubscribeSolStaking",
        "Subscribe SOL Staking API allows users to stake SOL and receive BNSOL in return. This endpoint requires specifying the amount of SOL to stake, and the response includes the equivalent BNSOL amount and exchange rate for SOL to BNSOL.",
        {
            amount: z.number().min(0).describe("Amount in SOL (mandatory)"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await stakingClient.restAPI.subscribeSolStaking({
                    amount: params.amount,
                    ...(params.recvWindow !== undefined && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully stake SOL and receive BNSOL in return: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to stake SOL. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
