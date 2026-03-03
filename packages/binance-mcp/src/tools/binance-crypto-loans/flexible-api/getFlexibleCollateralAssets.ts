/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-crypto-loans/flexible-api/getFlexibleCollateralAssets.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cryptoLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCryptoLoansFlexibleCollateral(server: McpServer) {
    server.tool(
        "BinanceCryptoLoansFlexibleCollateral",
        "Get list of assets that can be used as collateral for flexible loans. Shows LTV ratios and collateral limits.",
        {
            collateralCoin: z.string().optional()
                .describe("Filter by specific collateral coin (e.g., 'BTC', 'ETH')"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await cryptoLoanClient.restAPI.getFlexibleLoanCollateralAssetsData({
                    ...(params.collateralCoin && { collateralCoin: params.collateralCoin }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `Flexible Loan Collateral Assets:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get collateral assets: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
