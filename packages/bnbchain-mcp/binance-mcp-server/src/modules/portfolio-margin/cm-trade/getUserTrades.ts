/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/portfolio-margin/cm-trade/getUserTrades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginCmGetUserTrades(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginCmGetUserTrades",
        "Get COIN-M Futures trade history in Portfolio Margin mode.",
        {
            symbol: z.string().optional().describe("Trading pair symbol (e.g., 'BTCUSD_PERP')"),
            pair: z.string().optional().describe("Trading pair (e.g., 'BTCUSD')"),
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            fromId: z.number().int().optional().describe("Trade ID to start from"),
            limit: z.number().int().min(1).max(1000).optional().describe("Number of trades to return (default 500, max 1000)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await portfolioMarginClient.restAPI.cmUserTrades({
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.pair && { pair: params.pair }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.fromId && { fromId: params.fromId }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Portfolio Margin CM Trade History\n\n`;
                
                if (Array.isArray(data) && data.length > 0) {
                    result += `Total trades: ${data.length}\n\n`;
                    data.slice(0, 20).forEach((trade: any, index: number) => {
                        result += `**${index + 1}. ${trade.symbol}**\n`;
                        result += `  Trade ID: ${trade.id}\n`;
                        result += `  Order ID: ${trade.orderId}\n`;
                        result += `  Side: ${trade.side} | Price: ${trade.price}\n`;
                        result += `  Qty: ${trade.qty} | Base Qty: ${trade.baseQty}\n`;
                        result += `  Realized PnL: ${trade.realizedPnl}\n`;
                        result += `  Commission: ${trade.commission} ${trade.commissionAsset}\n`;
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
                        text: `❌ Failed to get Portfolio Margin CM trades: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
