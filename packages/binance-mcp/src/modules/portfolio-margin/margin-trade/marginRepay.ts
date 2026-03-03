/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/portfolio-margin/margin-trade/marginRepay.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginMarginRepay(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginMarginRepay",
        "Repay borrowed funds in Portfolio Margin mode.",
        {
            asset: z.string().describe("Asset to repay (e.g., 'USDT')"),
            amount: z.string().describe("Amount to repay"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await portfolioMarginClient.restAPI.marginRepay({
                    asset: params.asset,
                    amount: params.amount,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Portfolio Margin Repayment Successful!\n\nTransaction ID: ${data.tranId}\nAsset: ${params.asset}\nAmount: ${params.amount}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to repay funds: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
