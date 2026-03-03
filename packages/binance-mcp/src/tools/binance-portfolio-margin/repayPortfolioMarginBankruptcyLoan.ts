// src/tools/binance-portfolio-margin/repayPortfolioMarginBankruptcyLoan.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { portfolioMarginClient } from "../../config/binanceClient.js";

export function registerBinancePortfolioMarginRepayBankruptcyLoan(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginRepayBankruptcyLoan",
        "Repay portfolio margin bankruptcy loan.",
        {
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ recvWindow }) => {
            try {
                const params: Record<string, any> = {};
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await portfolioMarginClient.repayBankruptcyLoan(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully repaid bankruptcy loan. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to repay bankruptcy loan: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
