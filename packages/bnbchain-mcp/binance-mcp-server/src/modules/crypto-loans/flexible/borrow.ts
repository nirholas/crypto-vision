/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/crypto-loans/flexible/borrow.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cryptoLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerFlexibleLoanBorrow(server: McpServer) {
    server.tool(
        "BinanceCryptoLoanFlexibleBorrow",
        "Borrow crypto using a flexible loan. ⚠️ Your collateral will be locked. Interest accrues daily. Monitor LTV ratio to avoid liquidation.",
        {
            loanCoin: z.string().describe("Coin to borrow (e.g., 'USDT')"),
            loanAmount: z.string().optional().describe("Amount to borrow (provide either loanAmount or collateralAmount)"),
            collateralCoin: z.string().describe("Collateral coin (e.g., 'BTC')"),
            collateralAmount: z.string().optional().describe("Collateral amount (provide either loanAmount or collateralAmount)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
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
                        text: `✅ Flexible Loan Borrowed!\n\nLoan Coin: ${params.loanCoin}\nCollateral: ${params.collateralCoin}\n\n⚠️ Remember to monitor your LTV ratio and repay to avoid liquidation.\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to borrow: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
