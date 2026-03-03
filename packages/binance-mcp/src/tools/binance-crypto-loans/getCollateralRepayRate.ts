// src/tools/binance-crypto-loans/getCollateralRepayRate.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { cryptoLoanClient } from "../../config/binanceClient.js";

export function registerBinanceCryptoLoanGetCollateralRepayRate(server: McpServer) {
    server.tool(
        "BinanceCryptoLoanGetCollateralRepayRate",
        "Check collateral repay rate for crypto loans.",
        {
            loanCoin: z.string().describe("Loan coin (e.g., USDT)"),
            collateralCoin: z.string().describe("Collateral coin (e.g., BTC)"),
            repayAmount: z.number().describe("Repay amount")
        },
        async ({ loanCoin, collateralCoin, repayAmount }) => {
            try {
                const params: any = { loanCoin, collateralCoin, repayAmount };
                
                const response = await cryptoLoanClient.restAPI.checkCollateralRepayRate(params);
                const data = await response.data();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Collateral repay rate retrieved. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get collateral repay rate: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
