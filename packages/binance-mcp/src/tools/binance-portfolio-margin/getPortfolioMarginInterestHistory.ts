// src/tools/binance-portfolio-margin/getPortfolioMarginInterestHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { portfolioMarginClient } from "../../config/binanceClient.js";

export function registerBinancePortfolioMarginGetInterestHistory(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginGetInterestHistory",
        "Query portfolio margin interest history.",
        {
            asset: z.string().optional().describe("Asset symbol (e.g., BTC, USDT)"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            size: z.number().optional().describe("Number of results to return, default 10, max 100"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ asset, startTime, endTime, size, recvWindow }) => {
            try {
                const params: Record<string, any> = {};
                if (asset !== undefined) params.asset = asset;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (size !== undefined) params.size = size;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await portfolioMarginClient.getInterestHistory(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved interest history. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve interest history: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
