/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/crypto-loans/flexible/adjustLTV.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cryptoLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerFlexibleLoanAdjustLTV(server: McpServer) {
    server.tool(
        "BinanceCryptoLoanFlexibleAdjustLTV",
        "Adjust LTV (Loan-to-Value) ratio by adding or removing collateral. Lower LTV = safer position.",
        {
            loanCoin: z.string().describe("Loan coin"),
            collateralCoin: z.string().describe("Collateral coin"),
            adjustmentAmount: z.string().describe("Amount to add (positive) or remove (negative)"),
            direction: z.enum(["ADDITIONAL", "REDUCED"]).describe("ADDITIONAL to add collateral, REDUCED to remove"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await cryptoLoanClient.restAPI.flexibleLoanAdjustLTV({
                    loanCoin: params.loanCoin,
                    collateralCoin: params.collateralCoin,
                    adjustmentAmount: params.adjustmentAmount,
                    direction: params.direction,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `✅ LTV Adjusted!\n\nDirection: ${params.direction}\nAmount: ${params.adjustmentAmount} ${params.collateralCoin}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to adjust LTV: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
