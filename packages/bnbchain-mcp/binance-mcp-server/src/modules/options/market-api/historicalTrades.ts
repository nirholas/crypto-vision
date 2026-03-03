/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/options/market-api/historicalTrades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerOptionsMarketHistoricalTrades(server: McpServer) {
    server.tool(
        "BinanceOptionsHistoricalTrades",
        "Get older market trades for an options contract. Requires API key.",
        {
            symbol: z.string().describe("Option symbol (e.g., 'BTC-240126-40000-C')"),
            limit: z.number().int().min(1).max(500).optional()
                .describe("Number of trades to return (default 100, max 500)"),
            fromId: z.number().int().optional()
                .describe("Trade ID to fetch from. Default gets most recent trades")
        },
        async (params) => {
            try {
                const response = await optionsClient.restAPI.historicalTrades({
                    symbol: params.symbol,
                    ...(params.limit && { limit: params.limit }),
                    ...(params.fromId && { fromId: params.fromId })
                });
                
                const data = await response.data();
                
                let result = `✅ Historical Trades - ${params.symbol}\n\n`;
                
                if (Array.isArray(data) && data.length > 0) {
                    result += `Total trades returned: ${data.length}\n\n`;
                    data.slice(0, 20).forEach((trade: any, index: number) => {
                        const time = new Date(trade.time).toISOString();
                        result += `${index + 1}. ID: ${trade.id} | Price: ${trade.price} | Qty: ${trade.qty} | Time: ${time}\n`;
                    });
                    if (data.length > 20) {
                        result += `\n... and ${data.length - 20} more trades`;
                    }
                } else {
                    result += `No historical trades found`;
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
                        text: `❌ Failed to get Options historical trades: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
