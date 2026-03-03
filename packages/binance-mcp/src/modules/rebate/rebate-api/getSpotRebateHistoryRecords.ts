// src/tools/binance-pay/rebate-api/getSpotRebateHistoryRecords.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { rebateClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetSpotRebateHistoryRecords(server: McpServer) {
    server.tool(
        "BinanceGetSpotRebateHistoryRecords",
        "Retrieve the history of spot rebate records, including commission rebates and referral kickbacks, for the past 7 days or a custom date range (within 30 days).",
        {
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            page: z.number().int().default(1).describe("Page number, default is 1"),
            recvWindow: z.number().int().optional().describe("Optional time window for request validity")
        },
        async (params) => {
            try {
                const response = await rebateClient.restAPI.getSpotRebateHistoryRecords({
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.page && { page: params.page }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved the history of spot rebate records, including commission rebates and referral kickbacks. Response: ${JSON.stringify(
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
                            text: `Failed to retrieve the history of spot rebate records: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
