// src/tools/binance-portfolio-margin/getPortfolioMarginAccount.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { portfolioMarginClient } from "../../config/binanceClient.js";

export function registerBinancePortfolioMarginGetAccount(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginGetAccount",
        "Get portfolio margin account information including account status, balances, and positions.",
        {
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ recvWindow }) => {
            try {
                const params: Record<string, any> = {};
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await portfolioMarginClient.getAccount(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved portfolio margin account info. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve portfolio margin account: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
