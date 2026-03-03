/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-sub-account/management-api/getSubAccountList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spotClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceSubAccountList(server: McpServer) {
    server.tool(
        "BinanceSubAccountList",
        "Get a list of all sub-accounts under your master account. Returns email, status, and creation time for each sub-account.",
        {
            email: z.string().email().optional()
                .describe("Filter by specific sub-account email"),
            isFreeze: z.enum(["true", "false"]).optional()
                .describe("Filter by freeze status"),
            page: z.number().int().min(1).optional()
                .describe("Page number (starts from 1)"),
            limit: z.number().int().min(1).max(200).optional()
                .describe("Number of results per page (max 200)"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await spotClient.restAPI.querySubAccountList({
                    ...(params.email && { email: params.email }),
                    ...(params.isFreeze && { isFreeze: params.isFreeze }),
                    ...(params.page && { page: params.page }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `Sub-Account List:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get sub-account list: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
