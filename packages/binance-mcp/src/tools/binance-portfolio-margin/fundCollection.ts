// src/tools/binance-portfolio-margin/fundCollection.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { portfolioMarginClient } from "../../config/binanceClient.js";

export function registerBinancePortfolioMarginFundCollection(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginFundCollection",
        "Trigger fund collection by asset for portfolio margin account.",
        {
            asset: z.string().describe("Asset symbol to collect (e.g., BTC, USDT)"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ asset, recvWindow }) => {
            try {
                const params: Record<string, any> = { asset };
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await portfolioMarginClient.fundCollection(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Fund collection triggered for ${asset}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to trigger fund collection: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
