/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/portfolio-margin/account/getMaxBorrowable.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginGetMaxBorrowable(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginGetMaxBorrowable",
        "Query the maximum amount that can be borrowed for a specific asset in Portfolio Margin mode.",
        {
            asset: z.string().describe("Asset to query (e.g., 'USDT')"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await portfolioMarginClient.restAPI.marginMaxBorrowable({
                    asset: params.asset,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Portfolio Margin Max Borrowable\n\nAsset: ${params.asset}\nMax Borrowable Amount: ${data.amount}\nBorrowed: ${data.borrowedAmount || '0'}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get max borrowable: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
