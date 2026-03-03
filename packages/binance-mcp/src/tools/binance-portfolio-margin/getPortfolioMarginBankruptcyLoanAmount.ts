// src/tools/binance-portfolio-margin/getPortfolioMarginBankruptcyLoanAmount.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { portfolioMarginClient } from "../../config/binanceClient.js";

export function registerBinancePortfolioMarginGetBankruptcyLoanAmount(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginGetBankruptcyLoanAmount",
        "Query portfolio margin bankruptcy loan amount.",
        {
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ recvWindow }) => {
            try {
                const params: Record<string, any> = {};
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await portfolioMarginClient.getBankruptcyLoanAmount(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved bankruptcy loan amount. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve bankruptcy loan amount: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
