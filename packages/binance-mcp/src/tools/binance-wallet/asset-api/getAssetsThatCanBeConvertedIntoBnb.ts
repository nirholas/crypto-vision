// src/tools/binance-wallet/asset-api/getAssetsThatCanBeConvertedIntoBnb.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletGetAssetsThatCanBeConvertedIntoBnb(server: McpServer) {
    server.tool(
        "BinanceWalletGetAssetsThatCanBeConvertedIntoBnb",
        "Get assets that can be converted to BNB.",
        {
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ recvWindow }) => {
            try {
                const params: any = {};
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const response = await walletClient.restAPI.getAssetsThatCanBeConvertedIntoBnb(params);
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved assets that can be converted to BNB. Total: ${data.details?.length || 0}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve convertible assets: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}