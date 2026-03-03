/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/portfolio-margin/account/getAccountInfo.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginGetAccountInfo(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginGetAccount",
        "Get Portfolio Margin account information including unified account equity, margin status, and risk levels.",
        {
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await portfolioMarginClient.restAPI.account({
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Portfolio Margin Account Information\n\n`;
                
                if (data) {
                    result += `**Account Status**\n`;
                    result += `UniMMR: ${data.uniMMR}\n`;
                    result += `Account Equity: ${data.accountEquity}\n`;
                    result += `Actual Equity: ${data.actualEquity}\n`;
                    result += `Account Maint. Margin: ${data.accountMaintMargin}\n`;
                    result += `Account Status: ${data.accountStatus}\n\n`;
                    
                    if (data.accountType) {
                        result += `Account Type: ${data.accountType}\n`;
                    }
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
                        text: `❌ Failed to get Portfolio Margin account: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
