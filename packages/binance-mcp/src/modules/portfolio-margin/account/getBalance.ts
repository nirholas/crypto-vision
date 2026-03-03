/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/portfolio-margin/account/getBalance.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginGetBalance(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginGetBalance",
        "Get Portfolio Margin account balance information for all assets.",
        {
            asset: z.string().optional().describe("Asset to query (e.g., 'USDT'). If not provided, returns all assets"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await portfolioMarginClient.restAPI.balance({
                    ...(params.asset && { asset: params.asset }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Portfolio Margin Balance\n\n`;
                
                if (Array.isArray(data) && data.length > 0) {
                    result += `| Asset | Total | Available | In Order | Borrowed |\n`;
                    result += `|-------|-------|-----------|----------|----------|\n`;
                    data.forEach((balance: any) => {
                        result += `| ${balance.asset} | ${balance.totalWalletBalance || balance.balance} | ${balance.availableBalance || 'N/A'} | ${balance.crossWalletBalance || 'N/A'} | ${balance.borrowed || '0'} |\n`;
                    });
                } else if (data && !Array.isArray(data)) {
                    result += `**${data.asset}**\n`;
                    result += `Total Balance: ${data.totalWalletBalance || data.balance}\n`;
                    result += `Available: ${data.availableBalance || 'N/A'}\n`;
                    result += `Borrowed: ${data.borrowed || '0'}\n`;
                } else {
                    result += `No balance information found`;
                }
                
                return {
                    content: [{
                        type: "text",
                        text: result
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get Portfolio Margin balance: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
