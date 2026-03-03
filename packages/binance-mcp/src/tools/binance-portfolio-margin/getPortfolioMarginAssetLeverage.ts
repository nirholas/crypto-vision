// src/tools/binance-portfolio-margin/getPortfolioMarginAssetLeverage.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { portfolioMarginClient } from "../../config/binanceClient.js";

export function registerBinancePortfolioMarginGetAssetLeverage(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginGetAssetLeverage",
        "Query portfolio margin asset leverage information.",
        {
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ recvWindow }) => {
            try {
                const params: Record<string, any> = {};
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await portfolioMarginClient.getAssetLeverage(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved asset leverage information. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve asset leverage: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
