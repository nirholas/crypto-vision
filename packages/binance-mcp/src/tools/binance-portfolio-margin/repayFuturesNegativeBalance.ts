// src/tools/binance-portfolio-margin/repayFuturesNegativeBalance.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { portfolioMarginClient } from "../../config/binanceClient.js";

export function registerBinancePortfolioMarginRepayFuturesNegativeBalance(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginRepayFuturesNegativeBalance",
        "Repay futures negative balance for portfolio margin account.",
        {
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ recvWindow }) => {
            try {
                const params: Record<string, any> = {};
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await portfolioMarginClient.repayFuturesNegativeBalance(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Futures negative balance repaid. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to repay futures negative balance: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
