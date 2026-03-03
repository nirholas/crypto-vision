// src/tools/binance-crypto-loans/flexibleLoanRepay.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { cryptoLoanClient } from "../../config/binanceClient.js";

export function registerBinanceCryptoLoanFlexibleLoanRepay(server: McpServer) {
    server.tool(
        "BinanceCryptoLoanFlexibleLoanRepay",
        "Flexible loan repay.",
        {
            loanCoin: z.string().describe("Loan coin (e.g., USDT)"),
            collateralCoin: z.string().describe("Collateral coin (e.g., BTC)"),
            repayAmount: z.number().describe("Repay amount"),
            collateralReturn: z.boolean().optional().describe("Whether to return collateral"),
            fullRepayment: z.boolean().optional().describe("Whether to do full repayment")
        },
        async ({ loanCoin, collateralCoin, repayAmount, collateralReturn, fullRepayment }) => {
            try {
                const params: any = { loanCoin, collateralCoin, repayAmount };
                if (collateralReturn !== undefined) params.collateralReturn = collateralReturn;
                if (fullRepayment !== undefined) params.fullRepayment = fullRepayment;
                
                const response = await cryptoLoanClient.restAPI.flexibleLoanRepay(params);
                const data = await response.data();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Flexible loan repaid successfully. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to repay flexible loan: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
