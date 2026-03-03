// src/tools/binance-mining/mining-api/miningAccountEarning.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { miningClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceMiningAccountEarning(server: McpServer) {
    server.tool(
        "BinanceMiningAccountEarning",
        "Retrieves the earnings associated with a mining account, including the type of earnings (e.g., rebate, referral, refund), sub-account ID, the mining account name, and the amount earned. It also supports pagination for large data sets.",
        {
            algo: z.string().min(1).describe("Algorithm (e.g., sha256)"),
            startDate: z.number().int().optional().describe("Millisecond timestamp for the start date"),
            endDate: z.number().int().optional().describe("Millisecond timestamp for the end date"),
            pageIndex: z.number().int().min(1).optional().describe("Page number, default is 1"),
            pageSize: z
                .number()
                .int()
                .min(10)
                .max(200)
                .optional()
                .describe("Number of records per page, min 10, max 200"),
            recvWindow: z.number().int().optional().describe("Optional: cannot be greater than 60000")
        },
        async (params) => {
            try {
                const response = await miningClient.restAPI.miningAccountEarning({
                    algo: params.algo,
                    ...(params.startDate && { startDate: params.startDate }),
                    ...(params.endDate && { endDate: params.endDate }),
                    ...(params.pageIndex && { pageIndex: params.pageIndex }),
                    ...(params.pageSize && { pageSize: params.pageSize }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved the earnings associated with a mining account. Response: ${JSON.stringify(
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
                            text: `Failed to retrieve the earnings associated with a mining account. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
