/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-crypto-loans/fixed-api/repay.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cryptoLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCryptoLoansFixedRepay(server: McpServer) {
    server.tool(
        "BinanceCryptoLoansFixedRepay",
        "Repay a fixed-term crypto loan. Repaying unlocks your collateral.",
        {
            orderId: z.number().int()
                .describe("Loan order ID to repay"),
            amount: z.string()
                .describe("Amount to repay"),
            type: z.enum(["1", "2"]).optional()
                .describe("Repay type: 1 = repay with borrowed coin, 2 = repay with collateral"),
            collateralReturn: z.boolean().optional()
                .describe("Whether to return collateral after full repayment"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await cryptoLoanClient.restAPI.cryptoLoanRepay({
                    orderId: params.orderId,
                    amount: params.amount,
                    ...(params.type && { type: params.type }),
                    ...(params.collateralReturn !== undefined && { collateralReturn: params.collateralReturn }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `✅ Loan Repayment Successful!\n\nOrder ID: ${params.orderId}\nAmount Repaid: ${params.amount}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to repay loan: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
