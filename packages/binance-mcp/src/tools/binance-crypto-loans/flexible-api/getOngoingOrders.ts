/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-crypto-loans/flexible-api/getOngoingOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cryptoLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCryptoLoansFlexibleOngoing(server: McpServer) {
    server.tool(
        "BinanceCryptoLoansFlexibleOngoing",
        "Get all ongoing flexible loan orders. Shows current loans with principal, interest, collateral, and LTV information.",
        {
            loanCoin: z.string().optional()
                .describe("Filter by loan coin"),
            collateralCoin: z.string().optional()
                .describe("Filter by collateral coin"),
            current: z.number().int().min(1).optional()
                .describe("Current page (default 1)"),
            limit: z.number().int().min(1).max(100).optional()
                .describe("Results per page (max 100)"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await cryptoLoanClient.restAPI.getFlexibleLoanOngoingOrders({
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
                        text: `Ongoing Flexible Loans:\n${JSON.stringify(data, null, 2)}`
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
