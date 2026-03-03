/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/portfolio-margin/account/getUmPosition.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginGetUmPosition(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginGetUmPosition",
        "Get USDT-M Futures position risk information within Portfolio Margin mode.",
        {
            symbol: z.string().optional().describe("Trading pair symbol (e.g., 'BTCUSDT')"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await portfolioMarginClient.restAPI.umPositionRisk({
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Portfolio Margin UM Position Risk\n\n`;
                
                if (Array.isArray(data) && data.length > 0) {
                    const activePositions = data.filter((p: any) => parseFloat(p.positionAmt) !== 0);
                    
                    if (activePositions.length > 0) {
                        result += `Active Positions: ${activePositions.length}\n\n`;
                        activePositions.forEach((pos: any) => {
                            result += `**${pos.symbol}**\n`;
                            result += `  Position: ${pos.positionAmt}\n`;
                            result += `  Entry Price: ${pos.entryPrice}\n`;
                            result += `  Mark Price: ${pos.markPrice}\n`;
                            result += `  Unrealized PnL: ${pos.unrealizedProfit}\n`;
                            result += `  Liquidation Price: ${pos.liquidationPrice}\n`;
                            result += `  Leverage: ${pos.leverage}x\n`;
                            result += `  Margin Type: ${pos.marginType}\n\n`;
                        });
                    } else {
                        result += `No active UM positions`;
                    }
                } else {
                    result += `No position data found`;
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
                        text: `❌ Failed to get Portfolio Margin UM positions: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
