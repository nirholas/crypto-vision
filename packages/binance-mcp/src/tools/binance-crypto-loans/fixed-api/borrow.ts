/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-crypto-loans/fixed-api/borrow.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cryptoLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCryptoLoansFixedBorrow(server: McpServer) {
    server.tool(
        "BinanceCryptoLoansFixedBorrow",
        "Borrow crypto using a fixed-term loan. ⚠️ WARNING: Fixed loans have a specific term. Your collateral is locked until repayment. Failure to repay may result in liquidation.",
        {
            loanCoin: z.string()
                .describe("Coin to borrow (e.g., 'USDT')"),
            collateralCoin: z.string()
                .describe("Collateral coin (e.g., 'BTC')"),
            loanTerm: z.number().int()
                .describe("Loan term in days (7, 14, 30, 90, 180)"),
            loanAmount: z.string().optional()
                .describe("Amount to borrow (provide either loanAmount or collateralAmount)"),
            collateralAmount: z.string().optional()
                .describe("Collateral amount (provide either loanAmount or collateralAmount)"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                if (!params.loanAmount && !params.collateralAmount) {
                    return {
                        content: [{ type: "text", text: "❌ Either loanAmount or collateralAmount must be provided" }],
                        isError: true
                    };
                }

                const response = await cryptoLoanClient.restAPI.cryptoLoanBorrow({
                    loanCoin: params.loanCoin,
                    collateralCoin: params.collateralCoin,
                    loanTerm: params.loanTerm,
                    ...(params.loanAmount && { loanAmount: params.loanAmount }),
                    ...(params.collateralAmount && { collateralAmount: params.collateralAmount }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `✅ Fixed-Term Loan Created!\n\nLoan Coin: ${params.loanCoin}\nCollateral: ${params.collateralCoin}\nTerm: ${params.loanTerm} days\n\n⚠️ Remember to repay before the term ends to avoid liquidation.\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to borrow: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
