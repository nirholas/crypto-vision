/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-mining/mining-api/extraBonusList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { miningClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceExtraBonusList(server: McpServer) {
    server.tool(
        "BinanceExtraBonusList",
        "Retrieves extra bonuses related to mining activities, including merged mining, activity bonuses, rebates, smart pool bonuses, income transfers, and pool savings.",
        {
            algo: z.string().min(1).describe("Transfer algorithm (e.g., sha256)"),
            userName: z.string().min(1).describe("Mining account username"),
            coin: z.string().optional().describe("Coin name (optional)"),
            startDate: z.number().optional().describe("Search start date (milliseconds timestamp, optional)"),
            endDate: z.number().optional().describe("Search end date (milliseconds timestamp, optional)"),
            pageIndex: z.number().int().min(1).optional().describe("Page number, default is 1"),
            pageSize: z.number().int().min(10).max(200).optional().describe("Number of pages, minimum 10, maximum 200"),
            recvWindow: z.number().int().optional().describe("Optional: cannot be greater than 60000")
        },
        async (params) => {
            try {
                const response = await miningClient.restAPI.extraBonusList({
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
                            text: `Successfully retrieved extra bonuses related to mining activities. Response: ${JSON.stringify(
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
                            text: `Failed to retrieve extra bonuses related to mining activities. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
