/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/market-api/exchangeInfo.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";

export function registerBinanceDeliveryExchangeInfo(server: McpServer) {
    server.tool(
        "BinanceDeliveryExchangeInfo",
        "Get COIN-M Futures exchange information including trading rules, symbol info, and rate limits.",
        {},
        async () => {
            try {
                const response = await deliveryClient.restAPI.exchangeInfo();
                const data = await response.data();
                
                const symbolCount = data.symbols?.length || 0;
                
                return {
                    content: [{
                        type: "text",
                        text: `📊 COIN-M Futures Exchange Info\n\nTimezone: ${data.timezone}\nServer Time: ${new Date(data.serverTime).toISOString()}\nTotal Symbols: ${symbolCount}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get exchange info: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
