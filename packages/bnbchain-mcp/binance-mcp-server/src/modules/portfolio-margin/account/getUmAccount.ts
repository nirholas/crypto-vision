/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/portfolio-margin/account/getUmAccount.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginGetUmAccount(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginGetUmAccount",
        "Get USDT-M Futures account information within Portfolio Margin mode.",
        {
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await portfolioMarginClient.restAPI.umAccount({
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Portfolio Margin UM (USDT-M) Account\n\n`;
                
                if (data) {
                    result += `**Account Overview**\n`;
                    result += `Total Wallet Balance: ${data.totalWalletBalance}\n`;
                    result += `Total Unrealized Profit: ${data.totalUnrealizedProfit}\n`;
                    result += `Total Margin Balance: ${data.totalMarginBalance}\n`;
                    result += `Total Position Initial Margin: ${data.totalPositionInitialMargin}\n`;
                    result += `Total Open Order Initial Margin: ${data.totalOpenOrderInitialMargin}\n`;
                    result += `Total Cross Wallet Balance: ${data.totalCrossWalletBalance}\n`;
                    result += `Available Balance: ${data.availableBalance}\n`;
                    result += `Max Withdraw Amount: ${data.maxWithdrawAmount}\n\n`;
                    
                    if (data.assets && data.assets.length > 0) {
                        result += `**Assets**\n`;
                        data.assets.slice(0, 10).forEach((asset: any) => {
                            result += `- ${asset.asset}: Balance ${asset.walletBalance}, Available ${asset.availableBalance}\n`;
                        });
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
                        text: `❌ Failed to get Portfolio Margin UM account: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
