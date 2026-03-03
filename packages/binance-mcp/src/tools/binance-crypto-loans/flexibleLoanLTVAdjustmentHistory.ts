// src/tools/binance-crypto-loans/flexibleLoanLTVAdjustmentHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { cryptoLoanClient } from "../../config/binanceClient.js";

export function registerBinanceCryptoLoanFlexibleLoanLTVAdjustmentHistory(server: McpServer) {
    server.tool(
        "BinanceCryptoLoanFlexibleLoanLTVAdjustmentHistory",
        "Get flexible loan LTV adjustment history.",
        {
            loanCoin: z.string().optional().describe("Loan coin (e.g., USDT)"),
            collateralCoin: z.string().optional().describe("Collateral coin (e.g., BTC)"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            current: z.number().optional().describe("Current page"),
            limit: z.number().optional().describe("Page size, max 100")
        },
        async ({ loanCoin, collateralCoin, startTime, endTime, current, limit }) => {
            try {
                const params: any = {};
                if (loanCoin) params.loanCoin = loanCoin;
                if (collateralCoin) params.collateralCoin = collateralCoin;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (current !== undefined) params.current = current;
                if (limit !== undefined) params.limit = limit;
                
                const response = await cryptoLoanClient.restAPI.getFlexibleLoanLtvAdjustmentHistory(params);
                const data = await response.data();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Flexible loan LTV adjustment history retrieved. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get flexible loan LTV adjustment history: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
