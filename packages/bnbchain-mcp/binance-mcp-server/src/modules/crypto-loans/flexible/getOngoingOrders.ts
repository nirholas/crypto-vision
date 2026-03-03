/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/crypto-loans/flexible/getOngoingOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cryptoLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerFlexibleLoanOngoingOrders(server: McpServer) {
    server.tool(
        "BinanceCryptoLoanFlexibleOngoingOrders",
        "Get your current flexible loan positions. Shows outstanding amounts, collateral, and LTV ratios.",
        {
            loanCoin: z.string().optional().describe("Filter by loan coin"),
            collateralCoin: z.string().optional().describe("Filter by collateral coin"),
            current: z.number().int().min(1).default(1).optional().describe("Page number"),
            limit: z.number().int().min(1).max(100).default(10).optional().describe("Page size"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
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
                        text: `📊 Ongoing Flexible Loans\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get ongoing orders: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
