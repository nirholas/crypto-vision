// src/tools/binance-crypto-loans/flexibleLoanAdjustLTV.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { cryptoLoanClient } from "../../config/binanceClient.js";

export function registerBinanceCryptoLoanFlexibleLoanAdjustLTV(server: McpServer) {
    server.tool(
        "BinanceCryptoLoanFlexibleLoanAdjustLTV",
        "Flexible loan adjust LTV (Loan-to-Value).",
        {
            loanCoin: z.string().describe("Loan coin (e.g., USDT)"),
            collateralCoin: z.string().describe("Collateral coin (e.g., BTC)"),
            adjustmentAmount: z.number().describe("Adjustment amount"),
            direction: z.enum(["ADDITIONAL", "REDUCED"]).describe("Direction: ADDITIONAL = add collateral, REDUCED = reduce collateral")
        },
        async ({ loanCoin, collateralCoin, adjustmentAmount, direction }) => {
            try {
                const params: any = { loanCoin, collateralCoin, adjustmentAmount, direction };
                
                const response = await cryptoLoanClient.restAPI.flexibleLoanAdjustLtv(params);
                const data = await response.data();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Flexible loan LTV adjusted successfully. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to adjust flexible loan LTV: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
