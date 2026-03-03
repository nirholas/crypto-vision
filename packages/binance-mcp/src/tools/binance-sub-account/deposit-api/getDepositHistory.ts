/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-sub-account/deposit-api/getDepositHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spotClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceSubAccountDepositHistory(server: McpServer) {
    server.tool(
        "BinanceSubAccountDepositHistory",
        "Get deposit history for a sub-account. Shows all incoming deposits with status, txid, and confirmation details.",
        {
            email: z.string().email()
                .describe("Sub-account email to get deposit history for"),
            coin: z.string().optional()
                .describe("Filter by specific coin"),
            status: z.enum(["0", "1", "6"]).optional()
                .describe("Filter by status: 0 = pending, 1 = success, 6 = credited but cannot withdraw"),
            startTime: z.number().int().optional()
                .describe("Start timestamp in ms"),
            endTime: z.number().int().optional()
                .describe("End timestamp in ms"),
            limit: z.number().int().min(1).max(1000).optional()
                .describe("Number of results (max 1000)"),
            offset: z.number().int().optional()
                .describe("Offset for pagination"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await spotClient.restAPI.getSubAccountDepositHistory({
                    email: params.email,
                    ...(params.coin && { coin: params.coin }),
                    ...(params.status && { status: params.status }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.offset && { offset: params.offset }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `Sub-Account Deposit History for ${params.email}:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get deposit history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
