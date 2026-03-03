/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-mining/mining-api/hashrateResaleList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { miningClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceHashRateResaleList(server: McpServer) {
    server.tool(
        "BinanceHashRateResaleList",
        "Returns the list of hashRate resale configurations including transfer details such as algorithm, hashrate amount, sender and receiver pool usernames, start and end dates, and status of the transfer.",
        {
            pageIndex: z
                .number()
                .int()
                .min(1)
                .optional()
                .describe("Page number, default is the first page starting from 1"),
            pageSize: z
                .number()
                .int()
                .min(10)
                .max(200)
                .optional()
                .describe("Number of records per page, min 10, max 200"),
            recvWindow: z.number().int().optional().describe("Optional time window for request validity")
        },
        async (params) => {
            try {
                const response = await miningClient.restAPI.hashrateResaleList({
                    ...(params.pageIndex && { pageIndex: params.pageIndex }),
                    ...(params.pageSize && { pageSize: params.pageSize }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully return the list of hashRate resale configurations. Response: ${JSON.stringify(
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
                            text: `Failed to return the list of hashRate resale configurations. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
