/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-crypto-loans/fixed-api/adjustLTV.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cryptoLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCryptoLoansFixedAdjustLTV(server: McpServer) {
    server.tool(
        "BinanceCryptoLoansFixedAdjustLTV",
        "Adjust LTV for a fixed-term loan by adding or removing collateral.",
        {
            orderId: z.number().int()
                .describe("Loan order ID"),
            amount: z.string()
                .describe("Amount of collateral to add or remove"),
            direction: z.enum(["ADDITIONAL", "REDUCED"])
                .describe("Direction: ADDITIONAL to add collateral, REDUCED to remove"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await cryptoLoanClient.restAPI.cryptoLoanAdjustLtv({
                    orderId: params.orderId,
                    amount: params.amount,
                    direction: params.direction,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                const action = params.direction === "ADDITIONAL" ? "added" : "removed";
                return {
                    content: [{
                        type: "text",
                        text: `✅ LTV Adjusted!\n\nOrder ID: ${params.orderId}\nCollateral ${action}: ${params.amount}\n\n${JSON.stringify(data, null, 2)}`
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
