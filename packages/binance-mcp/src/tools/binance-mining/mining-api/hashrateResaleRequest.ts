// src/tools/binance-mining/mining-api/hashrateResaleRequest.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { miningClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceHashRateResaleRequest(server: McpServer) {
    server.tool(
        "BinanceHashRateResaleRequest",
        "Retrieve a request for setting up a hashrate resale, specifying the mining account, algorithm, start and end times, target mining account for resale, and the amount of hashrate to transfer",
        {
            userName: z.string().min(1).describe("Mining Account"),
            algo: z.string().min(1).describe("Transfer algorithm (e.g., sha256)"),
            endDate: z.number().int().describe("Resale End Time (Millisecond timestamp)"),
            startDate: z.number().int().describe("Resale Start Time (Millisecond timestamp)"),
            toPoolUser: z.string().min(1).describe("Mining Account of the recipient pool user"),
            hashRate: z
                .number()
                .int()
                .describe("Resale hashrate h/s must be transferred (BTC > 500000000000, ETH > 500000)"),
            recvWindow: z.number().int().optional().describe("Optional: Time window for request validity")
        },
        async (params) => {
            try {
                const response = await miningClient.restAPI.hashrateResaleRequest({
                    userName: params.userName,
                    algo: params.algo,
                    endDate: params.endDate,
                    startDate: params.startDate,
                    toPoolUser: params.toPoolUser,
                    hashRate: params.hashRate,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved request for setting up a hashrate resale. Response: ${JSON.stringify(
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
                            text: `Failed to retrieve request for setting up a hashrate resale. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
