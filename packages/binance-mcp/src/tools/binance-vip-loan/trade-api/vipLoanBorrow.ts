// src/tools/binance-vip-loan/trade-api/vipLoanBorrow.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { vipLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceVipLoanBorrow(server: McpServer) {
    server.tool(
        "BinanceVipLoanBorrow",
        "Allow  users (master account only) to apply for a loan by pledging collateral. Users specify the coin they want to borrow, the amount, and the collateral details.",
        {
            loanAccountId: z.number().int().describe("Loan account ID"),
            loanCoin: z.string().min(1).describe("Loan coin (e.g., BTC, ETH)"),
            loanAmount: z.number().describe("Loan amount as decimal"),
            collateralAccountId: z.string().min(1).describe("Collateral account IDs, separated by commas"),
            collateralCoin: z.string().min(1).describe("Collateral coins, separated by commas"),
            isFlexibleRate: z.boolean().describe("TRUE: flexible rate, FALSE: fixed rate. Default: TRUE"),
            loanTerm: z.number().int().optional().describe("Loan term (only required if fixed rate, e.g., 30/60 days)"),
            recvWindow: z.number().int().optional().describe("Optional time window for request validity")
        },
        async (params) => {
            try {
                const response = await vipLoanClient.restAPI.vipLoanBorrow({
                    loanAccountId: params.loanAccountId,
                    loanCoin: params.loanCoin,
                    loanAmount: params.loanAmount,
                    collateralAccountId: params.collateralAccountId,
                    collateralCoin: params.collateralCoin,
                    isFlexibleRate: params.isFlexibleRate,
                    ...(params.loanTerm !== undefined && { loanTerm: params.loanTerm }),
                    ...(params.recvWindow !== undefined && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully apply for a loan by pledging collateral. Response: ${JSON.stringify(
                                data
                            )}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to apply for a loan by pledging collateral. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
