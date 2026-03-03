// src/tools/binance-mining/mining-api/earningsList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { miningClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceEarningsList(server: McpServer) {
    server.tool(
        "BinanceEarningsList",
        "Retrieves list of earnings related to mining activities, including transferred hashrate, daily hashrate, profit amount, and the status of the payment (unpaid, paying, or paid).",
        {
            algo: z.string().min(1).describe("Transfer algorithm (e.g., sha256)"),
            userName: z.string().min(1).describe("Mining account username"),
            coin: z.string().optional().describe("Coin name (optional)"),
            startDate: z.number().optional().describe("Search start date (milliseconds timestamp, optional)"),
            endDate: z.number().optional().describe("Search end date (milliseconds timestamp, optional)"),
            pageIndex: z
                .number()
                .int()
                .min(1)
                .optional()
                .describe("Page number, default is the first page starting from 1"),
            pageSize: z.number().int().min(10).max(200).optional().describe("Number of pages, minimum 10, maximum 200"),
            recvWindow: z.number().int().optional().describe("Optional: cannot be greater than 60000")
        },
        async (params) => {
            try {
                const response = await miningClient.restAPI.earningsList({
                    algo: params.algo,
                    userName: params.userName,
                    ...(params.coin && { coin: params.coin }),
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
                            text: `Successfully retrieved list of earnings related to mining activities. Response: ${JSON.stringify(
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
                            text: `Failed to retrieve list of earnings related to mining activities. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
