/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/options/market-api/ticker.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerOptionsMarketTicker(server: McpServer) {
    server.tool(
        "BinanceOptionsTicker",
        "Get 24hr ticker price change statistics for options contracts. Returns price change, volume, and other trading stats.",
        {
            symbol: z.string().optional()
                .describe("Option symbol (e.g., 'BTC-240126-40000-C'). If not provided, returns all tickers")
        },
        async (params) => {
            try {
                const response = await optionsClient.restAPI.ticker({
                    ...(params.symbol && { symbol: params.symbol })
                });
                
                const data = await response.data();
                
                let result = `✅ Options 24hr Ticker Statistics\n\n`;
                
                const formatTicker = (ticker: any) => {
                    let str = `**${ticker.symbol}**\n`;
                    str += `  Price Change: ${ticker.priceChange} (${ticker.priceChangePercent}%)\n`;
                    str += `  Last Price: ${ticker.lastPrice}\n`;
                    str += `  High: ${ticker.high} | Low: ${ticker.low}\n`;
                    str += `  Volume: ${ticker.volume}\n`;
                    str += `  Quote Volume: ${ticker.quoteVolume}\n`;
                    str += `  Open Interest: ${ticker.openInterest}\n`;
                    return str;
                };
                
                if (Array.isArray(data)) {
                    result += `Total contracts: ${data.length}\n\n`;
                    data.slice(0, 15).forEach((ticker: any) => {
                        result += formatTicker(ticker) + '\n';
                    });
                    if (data.length > 15) {
                        result += `... and ${data.length - 15} more contracts`;
                    }
                } else if (data) {
                    result += formatTicker(data);
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
                        text: `❌ Failed to get Options ticker: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
