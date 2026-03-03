/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/crypto-loans/flexible/getFlexibleCollateralAssets.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cryptoLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerFlexibleCollateralAssets(server: McpServer) {
    server.tool(
        "BinanceCryptoLoanFlexibleCollateralAssets",
        "Get available collateral assets for flexible crypto loans. Shows which assets you can use as collateral.",
        {
            collateralCoin: z.string().optional().describe("Filter by collateral coin"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await cryptoLoanClient.restAPI.getFlexibleCollateralAssets({
                    ...(params.collateralCoin && { collateralCoin: params.collateralCoin }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `🔒 Flexible Loan Collateral Assets\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get collateral assets: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
