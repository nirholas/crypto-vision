/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/portfolio-margin/account/getMaxWithdraw.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginGetMaxWithdraw(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginGetMaxWithdraw",
        "Query the maximum amount that can be withdrawn for a specific asset from Portfolio Margin account.",
        {
            asset: z.string().describe("Asset to query (e.g., 'USDT')"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await portfolioMarginClient.restAPI.marginMaxWithdraw({
                    asset: params.asset,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Portfolio Margin Max Withdraw\n\nAsset: ${params.asset}\nMax Withdraw Amount: ${data.amount}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get max withdraw: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
