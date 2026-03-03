// src/tools/binance-portfolio-margin/changeAutoRepayFutures.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { portfolioMarginClient } from "../../config/binanceClient.js";

export function registerBinancePortfolioMarginChangeAutoRepayFutures(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginChangeAutoRepayFutures",
        "Change the auto-repay-futures status for portfolio margin account.",
        {
            autoRepay: z.boolean().describe("Enable or disable auto-repay for futures"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ autoRepay, recvWindow }) => {
            try {
                const params: Record<string, any> = { autoRepay };
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await portfolioMarginClient.changeAutoRepayFutures(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Auto-repay-futures status changed to ${autoRepay}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to change auto-repay-futures status: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
