/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-crypto-loans/fixed-api/getFixedCollateralData.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cryptoLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCryptoLoansFixedCollateral(server: McpServer) {
    server.tool(
        "BinanceCryptoLoansFixedCollateral",
        "Get list of collateral assets for fixed-term loans. Shows LTV ratios and limits.",
        {
            collateralCoin: z.string().optional()
                .describe("Filter by specific collateral coin"),
            vipLevel: z.number().int().min(0).max(9).optional()
                .describe("VIP level"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await cryptoLoanClient.restAPI.getCollateralAssetsData({
                    ...(params.collateralCoin && { collateralCoin: params.collateralCoin }),
                    ...(params.vipLevel !== undefined && { vipLevel: params.vipLevel }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `Fixed Loan Collateral Assets:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get collateral data: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
