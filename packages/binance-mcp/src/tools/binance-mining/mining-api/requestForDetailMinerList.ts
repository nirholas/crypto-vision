// src/tools/binance-mining/mining-api/requestForDetailMinerList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { miningClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceRequestForDetailMinerList(server: McpServer) {
    server.tool(
        "BinanceRequestForDetailMinerList",
        "Retrieves detailed hashrate data for a specific miner, including both hourly (H_hashrate) and daily (D_hashrate) metrics such as time, hashrate, and rejection rate.",
        {
            algo: z.string().min(1).describe("Algorithm (e.g., sha256)"),
            userName: z.string().min(1).describe("Mining account username"),
            workerName: z.string().min(1).describe("Miner’s name (required), e.g., bhdc1.16A10404B"),
            recvWindow: z.number().int().optional().describe("Optional: cannot be greater than 60000")
        },
        async (params) => {
            try {
                const response = await miningClient.restAPI.requestForDetailMinerList({
                    algo: params.algo,
                    userName: params.userName,
                    workerName: params.workerName,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved detailed hashrate data for a specific miner. Response: ${JSON.stringify(
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
                            text: `Failed to retrieve detailed hashrate data for a specific miner. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
