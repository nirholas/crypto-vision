/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/options/market-api/exchangeInfo.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";

export function registerOptionsMarketExchangeInfo(server: McpServer) {
    server.tool(
        "BinanceOptionsExchangeInfo",
        "Get current exchange trading rules and symbol information for options. Returns available option contracts, trading pairs, and their specifications.",
        {},
        async () => {
            try {
                const response = await optionsClient.restAPI.exchangeInfo();
                const data = await response.data();
                
                // Summarize the response
                const optionSymbols = data.optionSymbols || [];
                const assets = data.optionAssets || [];
                
                let summary = `✅ Options Exchange Information\n\n`;
                summary += `**Timezone**: ${data.timezone}\n`;
                summary += `**Server Time**: ${new Date(data.serverTime).toISOString()}\n\n`;
                summary += `**Available Assets**: ${assets.length}\n`;
                summary += `**Option Contracts**: ${optionSymbols.length}\n\n`;
                
                if (assets.length > 0) {
                    summary += `**Assets**: ${assets.map((a: any) => a.name || a).join(', ')}\n\n`;
                }
                
                // Show first few contracts as examples
                if (optionSymbols.length > 0) {
                    summary += `**Sample Contracts** (first 5):\n`;
                    optionSymbols.slice(0, 5).forEach((sym: any) => {
                        summary += `- ${sym.symbol}: ${sym.underlying} ${sym.side} Strike: ${sym.strikePrice} Expiry: ${sym.expiryDate}\n`;
                    });
                }
                
                return {
                    content: [{
                        type: "text",
                        text: summary
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get Options exchange info: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
