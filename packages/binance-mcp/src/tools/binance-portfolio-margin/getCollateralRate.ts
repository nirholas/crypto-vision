// src/tools/binance-portfolio-margin/getCollateralRate.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { portfolioMarginClient } from "../../config/binanceClient.js";

export function registerBinancePortfolioMarginGetCollateralRate(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginGetCollateralRate",
        "Query portfolio margin collateral rate for assets.",
        {
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ recvWindow }) => {
            try {
                const params: Record<string, any> = {};
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await portfolioMarginClient.getCollateralRate(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved portfolio margin collateral rate. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve collateral rate: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
