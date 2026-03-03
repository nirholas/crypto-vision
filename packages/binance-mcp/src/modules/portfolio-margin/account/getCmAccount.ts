/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/portfolio-margin/account/getCmAccount.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginGetCmAccount(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginGetCmAccount",
        "Get COIN-M Futures account information within Portfolio Margin mode.",
        {
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await portfolioMarginClient.restAPI.cmAccount({
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Portfolio Margin CM (COIN-M) Account\n\n`;
                
                if (data) {
                    result += `**Account Overview**\n`;
                    if (data.assets && data.assets.length > 0) {
                        result += `\n**Assets**\n`;
                        data.assets.forEach((asset: any) => {
                            result += `**${asset.asset}**\n`;
                            result += `  Wallet Balance: ${asset.walletBalance}\n`;
                            result += `  Unrealized Profit: ${asset.unrealizedProfit}\n`;
                            result += `  Margin Balance: ${asset.marginBalance}\n`;
                            result += `  Maint Margin: ${asset.maintMargin}\n`;
                            result += `  Available Balance: ${asset.availableBalance}\n\n`;
                        });
                    }
                    
                    if (data.positions && data.positions.length > 0) {
                        result += `\n**Positions**\n`;
                        data.positions.filter((p: any) => parseFloat(p.positionAmt) !== 0).forEach((pos: any) => {
                            result += `- ${pos.symbol}: ${pos.positionAmt} @ ${pos.entryPrice}\n`;
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
                        text: `❌ Failed to get Portfolio Margin CM account: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
