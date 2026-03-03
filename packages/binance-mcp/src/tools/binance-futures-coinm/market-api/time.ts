/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/market-api/time.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";

export function registerBinanceDeliveryTime(server: McpServer) {
    server.tool(
        "BinanceDeliveryTime",
        "Get the current server time from COIN-M Futures API.",
        {},
        async () => {
            try {
                const response = await deliveryClient.restAPI.time();
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `🕐 COIN-M Futures Server Time\n\nTimestamp: ${data.serverTime}\nDate: ${new Date(data.serverTime).toISOString()}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get server time: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
