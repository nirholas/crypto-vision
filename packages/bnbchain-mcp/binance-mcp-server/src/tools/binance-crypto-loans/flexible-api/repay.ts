/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-crypto-loans/flexible-api/repay.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cryptoLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCryptoLoansFlexibleRepay(server: McpServer) {
    server.tool(
        "BinanceCryptoLoansFlexibleRepay",
        "Repay a flexible crypto loan. Repaying reduces your debt and unlocks collateral proportionally.",
        {
            loanCoin: z.string()
                .describe("Loan coin to repay (e.g., 'USDT')"),
            collateralCoin: z.string()
                .describe("Collateral coin used for the loan (e.g., 'BTC')"),
            repayAmount: z.string()
                .describe("Amount to repay"),
            collateralReturn: z.boolean().optional()
                .describe("Whether to return collateral after full repayment (default: true)"),
            fullRepayment: z.boolean().optional()
                .describe("Whether this is a full repayment"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await cryptoLoanClient.restAPI.flexibleLoanRepay({
                    loanCoin: params.loanCoin,
                    collateralCoin: params.collateralCoin,
                    repayAmount: params.repayAmount,
                    ...(params.collateralReturn !== undefined && { collateralReturn: params.collateralReturn }),
                    ...(params.fullRepayment !== undefined && { fullRepayment: params.fullRepayment }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `✅ Loan Repayment Successful!\n\nRepaid: ${params.repayAmount} ${params.loanCoin}\n\n${JSON.stringify(data, null, 2)}`
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
