/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-crypto-loans/flexible-api/getFlexibleLoanAssets.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cryptoLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCryptoLoansFlexibleAssets(server: McpServer) {
    server.tool(
        "BinanceCryptoLoansFlexibleAssets",
        "Get list of assets available for flexible crypto loans. Shows borrowable assets with interest rates and limits.",
        {
            loanCoin: z.string().optional()
                .describe("Filter by specific loan coin (e.g., 'USDT', 'BUSD')"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await cryptoLoanClient.restAPI.getFlexibleLoanAssetsData({
                    ...(params.loanCoin && { loanCoin: params.loanCoin }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `Flexible Loan Assets:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get loan assets: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
