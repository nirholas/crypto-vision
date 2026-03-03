/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-crypto-loans/fixed-api/customizeMarginCall.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cryptoLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCryptoLoansFixedMarginCall(server: McpServer) {
    server.tool(
        "BinanceCryptoLoansFixedMarginCall",
        "Customize margin call threshold for a loan. Set when you want to be notified about LTV changes.",
        {
            orderId: z.number().int()
                .describe("Loan order ID"),
            marginCall: z.number()
                .describe("Margin call LTV threshold (e.g., 0.8 for 80%)"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await cryptoLoanClient.restAPI.customizeMarginCall({
                    orderId: params.orderId,
                    marginCall: params.marginCall,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `✅ Margin call threshold updated!\n\nOrder ID: ${params.orderId}\nNew Threshold: ${params.marginCall * 100}%\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to customize margin call: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
