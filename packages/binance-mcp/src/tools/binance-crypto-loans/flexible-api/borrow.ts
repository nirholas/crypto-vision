/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-crypto-loans/flexible-api/borrow.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cryptoLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCryptoLoansFlexibleBorrow(server: McpServer) {
    server.tool(
        "BinanceCryptoLoansFlexibleBorrow",
        "Borrow crypto using a flexible loan. ⚠️ WARNING: Your collateral will be locked. Interest accrues daily. If LTV ratio exceeds threshold, liquidation may occur.",
        {
            loanCoin: z.string()
                .describe("Coin to borrow (e.g., 'USDT', 'BUSD')"),
            collateralCoin: z.string()
                .describe("Collateral coin (e.g., 'BTC', 'ETH')"),
            loanAmount: z.string().optional()
                .describe("Amount to borrow (provide either loanAmount or collateralAmount)"),
            collateralAmount: z.string().optional()
                .describe("Collateral amount (provide either loanAmount or collateralAmount)"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                // Validate that either loanAmount or collateralAmount is provided
                if (!params.loanAmount && !params.collateralAmount) {
                    return {
                        content: [{ type: "text", text: "❌ Either loanAmount or collateralAmount must be provided" }],
                        isError: true
                    };
                }

                const response = await cryptoLoanClient.restAPI.flexibleLoanBorrow({
                    loanCoin: params.loanCoin,
                    collateralCoin: params.collateralCoin,
                    ...(params.loanAmount && { loanAmount: params.loanAmount }),
                    ...(params.collateralAmount && { collateralAmount: params.collateralAmount }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `✅ Flexible Loan Borrowed!\n\nLoan Coin: ${params.loanCoin}\nCollateral: ${params.collateralCoin}\n\n⚠️ Monitor your LTV ratio regularly to avoid liquidation.\n\n${JSON.stringify(data, null, 2)}`
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
