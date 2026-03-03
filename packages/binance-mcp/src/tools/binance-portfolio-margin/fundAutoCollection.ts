// src/tools/binance-portfolio-margin/fundAutoCollection.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { portfolioMarginClient } from "../../config/binanceClient.js";

export function registerBinancePortfolioMarginFundAutoCollection(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginFundAutoCollection",
        "Enable or configure fund auto-collection for portfolio margin account.",
        {
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ recvWindow }) => {
            try {
                const params: Record<string, any> = {};
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await portfolioMarginClient.fundAutoCollection(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Fund auto-collection configured. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to configure fund auto-collection: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
