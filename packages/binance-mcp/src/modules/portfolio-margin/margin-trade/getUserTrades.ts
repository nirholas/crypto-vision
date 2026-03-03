/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/portfolio-margin/margin-trade/getUserTrades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginMarginGetUserTrades(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginMarginGetUserTrades",
        "Get cross margin trade history in Portfolio Margin mode.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., 'BTCUSDT')"),
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            fromId: z.number().int().optional().describe("Trade ID to start from"),
            limit: z.number().int().min(1).max(1000).optional().describe("Number of trades to return (default 500, max 1000)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await portfolioMarginClient.restAPI.marginMyTrades({
                    symbol: params.symbol,
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.fromId && { fromId: params.fromId }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Portfolio Margin Margin Trade History - ${params.symbol}\n\n`;
                
                if (Array.isArray(data) && data.length > 0) {
                    result += `Total trades: ${data.length}\n\n`;
                    data.slice(0, 20).forEach((trade: any, index: number) => {
                        result += `**${index + 1}. Trade ID: ${trade.id}**\n`;
                        result += `  Order ID: ${trade.orderId}\n`;
                        result += `  Price: ${trade.price} | Qty: ${trade.qty}\n`;
                        result += `  Quote Qty: ${trade.quoteQty}\n`;
                        result += `  Commission: ${trade.commission} ${trade.commissionAsset}\n`;
                        result += `  Is Buyer: ${trade.isBuyer} | Is Maker: ${trade.isMaker}\n`;
                        result += `  Time: ${new Date(trade.time).toISOString()}\n\n`;
                    });
                    if (data.length > 20) {
                        result += `... and ${data.length - 20} more trades`;
                    }
                } else {
                    result += `No trades found`;
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
                        text: `❌ Failed to get Portfolio Margin margin trades: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
