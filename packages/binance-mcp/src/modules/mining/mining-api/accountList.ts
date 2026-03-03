// src/tools/binance-mining/mining-api/accountList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { miningClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceAccountList(server: McpServer) {
    server.tool(
        "BinanceAccountList",
        "Retrieve hashrate statistics for a mining account. It returns both hourly (H_hashrate) and daily (D_hashrate) data, including timestamps, hashrate values, and rejection rates.",
        {
            algo: z.string().min(1).describe("Algorithm (e.g., sha256)"),
            userName: z.string().min(1).describe("Mining account"),
            recvWindow: z.number().int().optional().describe("Optional time window for request validity")
        },
        async (params) => {
            try {
                const response = await miningClient.restAPI.accountList({
                    algo: params.algo,
                    userName: params.userName,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved hashrate statistics for a mining account.. Response: ${JSON.stringify(
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
                            text: `Failed to retrieve hashrate statistics for a mining account.. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
