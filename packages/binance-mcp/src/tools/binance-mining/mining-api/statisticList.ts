// src/tools/binance-mining/mining-api/statisticList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { miningClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceStatisticList(server: McpServer) {
    server.tool(
        "BinanceStatisticList",
        "Retrieve mining statistics for a specific account, including hash rates for the past 15 minutes and 24 hours, the number of valid and invalid mining units, and the estimated profit for today and yesterday in various cryptocurrencies.",
        {
            algo: z.string().min(1).describe("Algorithm (e.g., sha256)"),
            userName: z.string().min(1).describe("Mining account username"),
            recvWindow: z.number().int().optional().describe("Optional: Time window for request validity")
        },
        async (params) => {
            try {
                const response = await miningClient.restAPI.statisticList({
                    algo: params.algo,
                    userName: params.userName,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved mining statistics for a specific account. Response: ${JSON.stringify(
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
                            text: `Failed to retrieve mining statistics for a specific account. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
