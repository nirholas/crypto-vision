// src/tools/binance-crypto-loans/flexibleLoanCollateralAssets.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { cryptoLoanClient } from "../../config/binanceClient.js";

export function registerBinanceCryptoLoanFlexibleLoanCollateralAssets(server: McpServer) {
    server.tool(
        "BinanceCryptoLoanFlexibleLoanCollateralAssets",
        "Get flexible loan collateral assets.",
        {
            collateralCoin: z.string().optional().describe("Collateral coin (e.g., BTC)")
        },
        async ({ collateralCoin }) => {
            try {
                const params: any = {};
                if (collateralCoin) params.collateralCoin = collateralCoin;
                
                const response = await cryptoLoanClient.restAPI.getFlexibleLoanCollateralAssetsData(params);
                const data = await response.data();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Flexible loan collateral assets retrieved. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get flexible loan collateral assets: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
