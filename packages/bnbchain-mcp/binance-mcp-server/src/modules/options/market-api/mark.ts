/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/options/market-api/mark.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerOptionsMarketMark(server: McpServer) {
    server.tool(
        "BinanceOptionsMark",
        "Get the mark price for options contracts. Mark price is used for liquidation and margin calculations.",
        {
            symbol: z.string().optional()
                .describe("Option symbol (e.g., 'BTC-240126-40000-C'). If not provided, returns all mark prices")
        },
        async (params) => {
            try {
                const response = await optionsClient.restAPI.mark({
                    ...(params.symbol && { symbol: params.symbol })
                });
                
                const data = await response.data();
                
                let result = `✅ Options Mark Prices\n\n`;
                
                if (Array.isArray(data)) {
                    result += `Total contracts: ${data.length}\n\n`;
                    data.slice(0, 20).forEach((item: any) => {
                        result += `**${item.symbol}**\n`;
                        result += `  Mark Price: ${item.markPrice}\n`;
                        result += `  Bid IV: ${item.bidIV} | Ask IV: ${item.askIV}\n`;
                        result += `  Mark IV: ${item.markIV}\n`;
                        result += `  Delta: ${item.delta} | Theta: ${item.theta}\n`;
                        result += `  Gamma: ${item.gamma} | Vega: ${item.vega}\n\n`;
                    });
                    if (data.length > 20) {
                        result += `... and ${data.length - 20} more contracts`;
                    }
                } else if (data) {
                    result += `**${data.symbol}**\n`;
                    result += `Mark Price: ${data.markPrice}\n`;
                    result += `Bid IV: ${data.bidIV} | Ask IV: ${data.askIV}\n`;
                    result += `Mark IV: ${data.markIV}\n`;
                    result += `Delta: ${data.delta} | Theta: ${data.theta}\n`;
                    result += `Gamma: ${data.gamma} | Vega: ${data.vega}\n`;
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
                        text: `❌ Failed to get Options mark prices: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
