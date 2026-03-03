/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/portfolio-margin/margin-trade/marginLoan.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginMarginLoan(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginMarginLoan",
        "Borrow funds for margin trading in Portfolio Margin mode. ⚠️ Borrowed funds accrue interest.",
        {
            asset: z.string().describe("Asset to borrow (e.g., 'USDT')"),
            amount: z.string().describe("Amount to borrow"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await portfolioMarginClient.restAPI.marginLoan({
                    asset: params.asset,
                    amount: params.amount,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Portfolio Margin Loan Successful!\n\nTransaction ID: ${data.tranId}\nAsset: ${params.asset}\nAmount: ${params.amount}\n\n⚠️ Note: Borrowed funds will accrue interest.`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to borrow funds: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
