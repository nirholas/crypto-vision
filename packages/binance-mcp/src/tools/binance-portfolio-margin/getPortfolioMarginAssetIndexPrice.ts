// src/tools/binance-portfolio-margin/getPortfolioMarginAssetIndexPrice.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { portfolioMarginClient } from "../../config/binanceClient.js";

export function registerBinancePortfolioMarginGetAssetIndexPrice(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginGetAssetIndexPrice",
        "Query portfolio margin asset index price.",
        {
            asset: z.string().optional().describe("Asset symbol (e.g., BTC, ETH). If not provided, returns all assets"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ asset, recvWindow }) => {
            try {
                const params: Record<string, any> = {};
                if (asset !== undefined) params.asset = asset;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await portfolioMarginClient.getAssetIndexPrice(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved asset index price. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve asset index price: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
