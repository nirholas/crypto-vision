/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-crypto-loans/fixed-api/getFixedLoanData.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cryptoLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCryptoLoansFixedAssets(server: McpServer) {
    server.tool(
        "BinanceCryptoLoansFixedAssets",
        "Get list of assets available for fixed-term crypto loans. Shows borrowable assets with interest rates, terms, and limits.",
        {
            loanCoin: z.string().optional()
                .describe("Filter by specific loan coin"),
            vipLevel: z.number().int().min(0).max(9).optional()
                .describe("VIP level for rate calculation"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await cryptoLoanClient.restAPI.getLoanableAssetsData({
                    ...(params.loanCoin && { loanCoin: params.loanCoin }),
                    ...(params.vipLevel !== undefined && { vipLevel: params.vipLevel }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `Fixed Loan Assets:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get fixed loan assets: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
