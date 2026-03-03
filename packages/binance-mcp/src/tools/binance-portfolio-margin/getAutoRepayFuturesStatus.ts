// src/tools/binance-portfolio-margin/getAutoRepayFuturesStatus.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { portfolioMarginClient } from "../../config/binanceClient.js";

export function registerBinancePortfolioMarginGetAutoRepayFuturesStatus(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginGetAutoRepayFuturesStatus",
        "Get the current auto-repay-futures status for portfolio margin account.",
        {
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ recvWindow }) => {
            try {
                const params: Record<string, any> = {};
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await portfolioMarginClient.getAutoRepayFuturesStatus(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved auto-repay-futures status. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve auto-repay-futures status: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
