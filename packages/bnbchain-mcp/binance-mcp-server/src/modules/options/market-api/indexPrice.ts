/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/options/market-api/indexPrice.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerOptionsMarketIndex(server: McpServer) {
    server.tool(
        "BinanceOptionsIndex",
        "Get the current index price for the underlying asset. The index price is used as a reference for options pricing.",
        {
            underlying: z.string().describe("Underlying asset (e.g., 'BTCUSDT', 'ETHUSDT')")
        },
        async (params) => {
            try {
                const response = await optionsClient.restAPI.index({
                    underlying: params.underlying
                });
                
                const data = await response.data();
                
                let result = `✅ Options Index Price\n\n`;
                
                if (Array.isArray(data)) {
                    data.forEach((item: any) => {
                        result += `**${item.underlying || item.indexSymbol}**\n`;
                        result += `Index Price: ${item.indexPrice}\n`;
                        if (item.time) {
                            result += `Time: ${new Date(item.time).toISOString()}\n`;
                        }
                        result += '\n';
                    });
                } else if (data) {
                    result += `**${data.underlying || data.indexSymbol || params.underlying}**\n`;
                    result += `Index Price: ${data.indexPrice}\n`;
                    if (data.time) {
                        result += `Time: ${new Date(data.time).toISOString()}\n`;
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
                        text: `❌ Failed to get Options index price: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
