/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/options/trade-api/getUserTrades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerOptionsGetUserTrades(server: McpServer) {
    server.tool(
        "BinanceOptionsGetUserTrades",
        "Get user's options trade history. Returns executed trades with prices and quantities.",
        {
            symbol: z.string().optional().describe("Option symbol to filter by"),
            underlying: z.string().optional().describe("Underlying asset to filter by (e.g., 'BTCUSDT')"),
            fromId: z.number().int().optional().describe("Trade ID to fetch from"),
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            limit: z.number().int().min(1).max(1000).optional().describe("Number of trades to return (default 100, max 1000)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await optionsClient.restAPI.userTrades({
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.underlying && { underlying: params.underlying }),
                    ...(params.fromId && { fromId: params.fromId }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Options Trade History\n\n`;
                
                if (Array.isArray(data) && data.length > 0) {
                    result += `Total trades: ${data.length}\n\n`;
                    data.slice(0, 20).forEach((trade: any, index: number) => {
                        result += `**${index + 1}. ${trade.symbol}**\n`;
                        result += `  Trade ID: ${trade.id}\n`;
                        result += `  Order ID: ${trade.orderId}\n`;
                        result += `  Side: ${trade.side}\n`;
                        result += `  Price: ${trade.price} | Qty: ${trade.quantity}\n`;
                        result += `  Fee: ${trade.fee} ${trade.feeAsset}\n`;
                        result += `  Realized PnL: ${trade.realizedProfit}\n`;
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
                        text: `❌ Failed to get options trades: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
