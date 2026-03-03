/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/crypto-loans/flexible/getBorrowHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cryptoLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerFlexibleLoanBorrowHistory(server: McpServer) {
    server.tool(
        "BinanceCryptoLoanFlexibleBorrowHistory",
        "Get your flexible loan borrowing history.",
        {
            loanCoin: z.string().optional().describe("Filter by loan coin"),
            collateralCoin: z.string().optional().describe("Filter by collateral coin"),
            startTime: z.number().int().optional().describe("Start time in ms"),
            endTime: z.number().int().optional().describe("End time in ms"),
            current: z.number().int().min(1).default(1).optional().describe("Page number"),
            limit: z.number().int().min(1).max(100).default(10).optional().describe("Page size"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await cryptoLoanClient.restAPI.getFlexibleLoanBorrowHistory({
                    ...(params.loanCoin && { loanCoin: params.loanCoin }),
                    ...(params.collateralCoin && { collateralCoin: params.collateralCoin }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.current && { current: params.current }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `📜 Flexible Loan Borrow History\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get borrow history: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
