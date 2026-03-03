// src/tools/binance-portfolio-margin/getAccountBalance.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { portfolioMarginClient } from "../../config/binanceClient.js";

export function registerBinancePortfolioMarginGetAccountBalance(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginGetAccountBalance",
        "Query portfolio margin account balance.",
        {
            asset: z.string().optional().describe("Asset symbol (e.g., BTC, USDT). If not provided, returns all assets"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ asset, recvWindow }) => {
            try {
                const params: Record<string, any> = {};
                if (asset !== undefined) params.asset = asset;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await portfolioMarginClient.getBalance(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved account balance. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve account balance: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
