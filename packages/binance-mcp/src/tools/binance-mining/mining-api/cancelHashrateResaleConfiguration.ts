// src/tools/binance-mining/mining-api/cancelHashrateResaleConfiguration.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { miningClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCancelHashRateResaleConfiguration(server: McpServer) {
    server.tool(
        "BinanceCancelHashRateResaleConfiguration",
        "Cancel an existing hashrate resale configuration using the mining ID and account details.",
        {
            configId: z.number().int().describe("Mining ID").min(1),
            userName: z.string().min(1).describe("Mining Account"),
            recvWindow: z.number().int().optional().describe("Optional: cannot be greater than 60000")
        },
        async (params) => {
            try {
                const response = await miningClient.restAPI.cancelHashrateResaleConfiguration({
                    configId: params.configId,
                    userName: params.userName,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully canceled an existing hashrate resale configuration. Response: ${JSON.stringify(
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
                            text: `Failed to canceled an existing hashrate resale configuration. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
