/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/options/market-api/depth.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerOptionsMarketDepth(server: McpServer) {
    server.tool(
        "BinanceOptionsDepth",
        "Get the order book depth for an options contract. Shows current bids and asks at various price levels.",
        {
            symbol: z.string().describe("Option symbol (e.g., 'BTC-240126-40000-C')"),
            limit: z.number().int().min(1).max(1000).optional()
                .describe("Limit the number of price levels returned (default 100, max 1000)")
        },
        async (params) => {
            try {
                const response = await optionsClient.restAPI.depth({
                    symbol: params.symbol,
                    ...(params.limit && { limit: params.limit })
                });
                
                const data = await response.data();
                
                let result = `✅ Options Order Book - ${params.symbol}\n\n`;
                
                // Format asks (sell orders)
                result += `**Asks (Sell Orders)**:\n`;
                if (data.asks && data.asks.length > 0) {
                    data.asks.slice(0, 10).forEach((ask: [string, string]) => {
                        result += `  Price: ${ask[0]} | Qty: ${ask[1]}\n`;
                    });
                } else {
                    result += `  No asks available\n`;
                }
                
                result += `\n**Bids (Buy Orders)**:\n`;
                if (data.bids && data.bids.length > 0) {
                    data.bids.slice(0, 10).forEach((bid: [string, string]) => {
                        result += `  Price: ${bid[0]} | Qty: ${bid[1]}\n`;
                    });
                } else {
                    result += `  No bids available\n`;
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
                        text: `❌ Failed to get Options order book: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
