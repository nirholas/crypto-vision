/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-crypto-loans/fixed-api/getBorrowHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cryptoLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCryptoLoansFixedBorrowHistory(server: McpServer) {
    server.tool(
        "BinanceCryptoLoansFixedBorrowHistory",
        "Get borrow history for fixed-term loans.",
        {
            orderId: z.number().int().optional()
                .describe("Filter by specific order ID"),
            loanCoin: z.string().optional()
                .describe("Filter by loan coin"),
            collateralCoin: z.string().optional()
                .describe("Filter by collateral coin"),
            startTime: z.number().int().optional()
                .describe("Start timestamp in ms"),
            endTime: z.number().int().optional()
                .describe("End timestamp in ms"),
            current: z.number().int().min(1).optional()
                .describe("Current page"),
            limit: z.number().int().min(1).max(100).optional()
                .describe("Results per page (max 100)"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await cryptoLoanClient.restAPI.getLoanBorrowHistory({
                    ...(params.orderId && { orderId: params.orderId }),
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
                        text: `Fixed Loan Borrow History:\n${JSON.stringify(data, null, 2)}`
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
