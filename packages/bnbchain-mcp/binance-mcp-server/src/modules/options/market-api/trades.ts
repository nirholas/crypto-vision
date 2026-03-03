/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/options/market-api/trades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerOptionsMarketTrades(server: McpServer) {
    server.tool(
        "BinanceOptionsTrades",
        "Get recent trades for an options contract. Shows the most recent executed trades.",
        {
            symbol: z.string().describe("Option symbol (e.g., 'BTC-240126-40000-C')"),
            limit: z.number().int().min(1).max(500).optional()
                .describe("Number of trades to return (default 100, max 500)")
        },
        async (params) => {
            try {
                const response = await optionsClient.restAPI.trades({
                    symbol: params.symbol,
                    ...(params.limit && { limit: params.limit })
                });
                
                const data = await response.data();
                
                let result = `✅ Recent Trades - ${params.symbol}\n\n`;
                
                if (Array.isArray(data) && data.length > 0) {
                    result += `Total trades returned: ${data.length}\n\n`;
                    data.slice(0, 20).forEach((trade: any, index: number) => {
                        const time = new Date(trade.time).toISOString();
                        result += `${index + 1}. Price: ${trade.price} | Qty: ${trade.qty} | Time: ${time}\n`;
                    });
                    if (data.length > 20) {
                        result += `\n... and ${data.length - 20} more trades`;
                    }
                } else {
                    result += `No recent trades found`;
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
                        text: `❌ Failed to get Options trades: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
