/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-crypto-loans/flexible-api/adjustLTV.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cryptoLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCryptoLoansFlexibleAdjustLTV(server: McpServer) {
    server.tool(
        "BinanceCryptoLoansFlexibleAdjustLTV",
        "Adjust LTV (Loan-to-Value) ratio by adding or removing collateral. Lower LTV reduces liquidation risk.",
        {
            loanCoin: z.string()
                .describe("Loan coin (e.g., 'USDT')"),
            collateralCoin: z.string()
                .describe("Collateral coin (e.g., 'BTC')"),
            adjustmentAmount: z.string()
                .describe("Amount of collateral to add or remove"),
            direction: z.enum(["ADDITIONAL", "REDUCED"])
                .describe("Direction: ADDITIONAL to add collateral (lower LTV), REDUCED to remove collateral (higher LTV)"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await cryptoLoanClient.restAPI.flexibleLoanAdjustLtv({
                    loanCoin: params.loanCoin,
                    collateralCoin: params.collateralCoin,
                    adjustmentAmount: params.adjustmentAmount,
                    direction: params.direction,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                const action = params.direction === "ADDITIONAL" ? "added" : "removed";
                return {
                    content: [{
                        type: "text",
                        text: `✅ LTV Adjusted!\n\nCollateral ${action}: ${params.adjustmentAmount} ${params.collateralCoin}\n\n${params.direction === "ADDITIONAL" ? "Your liquidation risk is now lower." : "⚠️ Your liquidation risk may have increased."}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to adjust LTV: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
