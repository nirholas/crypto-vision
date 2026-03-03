/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-crypto-loans/fixed-api/checkCollateralRate.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cryptoLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCryptoLoansFixedCollateralRate(server: McpServer) {
    server.tool(
        "BinanceCryptoLoansFixedCollateralRate",
        "Check the collateral repay rate for a specific loan and collateral pair. Useful for planning repayments.",
        {
            loanCoin: z.string()
                .describe("Loan coin (e.g., 'USDT')"),
            collateralCoin: z.string()
                .describe("Collateral coin (e.g., 'BTC')"),
            repayAmount: z.string()
                .describe("Amount to repay"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await cryptoLoanClient.restAPI.checkCollateralRepayRate({
                    loanCoin: params.loanCoin,
                    collateralCoin: params.collateralCoin,
                    repayAmount: params.repayAmount,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `Collateral Repay Rate:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to check collateral rate: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
