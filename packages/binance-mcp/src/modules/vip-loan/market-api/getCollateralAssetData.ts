// src/tools/binance-vip-loan/market-api/getCollateralAssetData.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { vipLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetCollateralAssetData(server: McpServer) {
    server.tool(
        "BinanceGetCollateralAssetData",
        "Retrieves information about collateral assets, including collateral ratios and range values for different tiers of collateral. The ratios are used to determine the collateral requirement for various levels of borrowing.",
        {
            collateralCoin: z.string().optional().describe("Optional: Coin used as collateral"),
            recvWindow: z.number().int().optional().describe("Optional time window for request validity")
        },
        async (params) => {
            try {
                const response = await vipLoanClient.restAPI.getCollateralAssetData({
                    ...(params.collateralCoin && { collateralCoin: params.collateralCoin }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved information about collateral assets. Response: ${JSON.stringify(
                                data
                            )}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to retrieve information about collateral assets. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
