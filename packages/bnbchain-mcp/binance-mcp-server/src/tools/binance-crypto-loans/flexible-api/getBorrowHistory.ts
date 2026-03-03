/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-crypto-loans/flexible-api/getBorrowHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cryptoLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCryptoLoansFlexibleBorrowHistory(server: McpServer) {
    server.tool(
        "BinanceCryptoLoansFlexibleBorrowHistory",
        "Get borrow history for flexible loans. Shows all past and current borrow transactions.",
        {
            loanCoin: z.string().optional()
                .describe("Filter by loan coin"),
            collateralCoin: z.string().optional()
                .describe("Filter by collateral coin"),
            startTime: z.number().int().optional()
                .describe("Start timestamp in ms"),
            endTime: z.number().int().optional()
                .describe("End timestamp in ms"),
            current: z.number().int().min(1).optional()
                .describe("Current page (default 1)"),
            limit: z.number().int().min(1).max(100).optional()
                .describe("Results per page (max 100)"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
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
                        text: `Flexible Loan Borrow History:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get borrow history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
