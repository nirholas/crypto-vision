/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/portfolio-margin/account/getMarginAccount.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginGetMarginAccount(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginGetMarginAccount",
        "Get cross margin account information within Portfolio Margin mode.",
        {
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await portfolioMarginClient.restAPI.marginAccount({
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Portfolio Margin - Cross Margin Account\n\n`;
                
                if (data) {
                    result += `**Account Overview**\n`;
                    result += `Borrow Enabled: ${data.borrowEnabled}\n`;
                    result += `Trade Enabled: ${data.tradeEnabled}\n`;
                    result += `Transfer Enabled: ${data.transferEnabled}\n`;
                    result += `Margin Level: ${data.marginLevel}\n`;
                    result += `Total Asset (BTC): ${data.totalAssetOfBtc}\n`;
                    result += `Total Liability (BTC): ${data.totalLiabilityOfBtc}\n`;
                    result += `Total Net Asset (BTC): ${data.totalNetAssetOfBtc}\n\n`;
                    
                    if (data.userAssets && data.userAssets.length > 0) {
                        result += `**Assets with Balance**\n`;
                        const assetsWithBalance = data.userAssets.filter((a: any) => 
                            parseFloat(a.free) > 0 || parseFloat(a.locked) > 0 || parseFloat(a.borrowed) > 0
                        );
                        assetsWithBalance.slice(0, 15).forEach((asset: any) => {
                            result += `**${asset.asset}**\n`;
                            result += `  Free: ${asset.free} | Locked: ${asset.locked}\n`;
                            result += `  Borrowed: ${asset.borrowed} | Interest: ${asset.interest}\n`;
                            result += `  Net Asset: ${asset.netAsset}\n\n`;
                        });
                        if (assetsWithBalance.length > 15) {
                            result += `... and ${assetsWithBalance.length - 15} more assets`;
                        }
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
                        text: `❌ Failed to get Portfolio Margin margin account: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
