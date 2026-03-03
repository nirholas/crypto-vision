/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/pay/pay-api/getHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { payClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinancePayGetHistory(server: McpServer) {
    server.tool(
        "BinancePayGetHistory",
        "Get your Binance Pay transaction history. Shows all Pay transactions including C2C transfers, merchant payments, and refunds.",
        {
            startTime: z.number().int().optional().describe("Start time in ms"),
            endTime: z.number().int().optional().describe("End time in ms"),
            limit: z.number().int().max(100).default(100).optional().describe("Number of records (max 100)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await payClient.restAPI.getPayTradeHistory({
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `📜 Binance Pay Transaction History\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get pay history: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
