/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-crypto-loans/fixed-api/getOngoingOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cryptoLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCryptoLoansFixedOngoing(server: McpServer) {
    server.tool(
        "BinanceCryptoLoansFixedOngoing",
        "Get ongoing fixed-term loan orders. Shows current loans with term, principal, interest, and LTV.",
        {
            orderId: z.number().int().optional()
                .describe("Filter by specific order ID"),
            loanCoin: z.string().optional()
                .describe("Filter by loan coin"),
            collateralCoin: z.string().optional()
                .describe("Filter by collateral coin"),
            current: z.number().int().min(1).optional()
                .describe("Current page"),
            limit: z.number().int().min(1).max(100).optional()
                .describe("Results per page (max 100)"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await cryptoLoanClient.restAPI.getLoanOngoingOrders({
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.loanCoin && { loanCoin: params.loanCoin }),
                    ...(params.collateralCoin && { collateralCoin: params.collateralCoin }),
                    ...(params.current && { current: params.current }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `Ongoing Fixed Loans:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get ongoing orders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
