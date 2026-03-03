// src/tools/binance-crypto-loans/flexibleLoanBorrow.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { cryptoLoanClient } from "../../config/binanceClient.js";

export function registerBinanceCryptoLoanFlexibleLoanBorrow(server: McpServer) {
    server.tool(
        "BinanceCryptoLoanFlexibleLoanBorrow",
        "Flexible loan borrow.",
        {
            loanCoin: z.string().describe("Loan coin (e.g., USDT)"),
            collateralCoin: z.string().describe("Collateral coin (e.g., BTC)"),
            loanAmount: z.number().optional().describe("Loan amount"),
            collateralAmount: z.number().optional().describe("Collateral amount")
        },
        async ({ loanCoin, collateralCoin, loanAmount, collateralAmount }) => {
            try {
                const params: any = { loanCoin, collateralCoin };
                if (loanAmount !== undefined) params.loanAmount = loanAmount;
                if (collateralAmount !== undefined) params.collateralAmount = collateralAmount;
                
                const response = await cryptoLoanClient.restAPI.flexibleLoanBorrow(params);
                const data = await response.data();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Flexible loan borrowed successfully. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to borrow flexible loan: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
