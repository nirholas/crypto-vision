/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-coinm/market-api/ping.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";

export function registerBinanceDeliveryPing(server: McpServer) {
    server.tool(
        "BinanceDeliveryPing",
        "Test connectivity to the COIN-M Futures API. Returns empty object if successful.",
        {},
        async () => {
            try {
                const response = await deliveryClient.restAPI.ping();
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ COIN-M Futures API is reachable\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ COIN-M Futures API ping failed: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
