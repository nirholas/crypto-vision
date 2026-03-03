/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/options/market-api/ping.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";

export function registerOptionsMarketPing(server: McpServer) {
    server.tool(
        "BinanceOptionsPing",
        "Test connectivity to the Options API. Returns empty object if successful.",
        {},
        async () => {
            try {
                const response = await optionsClient.restAPI.ping();
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Options API connectivity test successful!\n\nResponse: ${JSON.stringify(data)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Options API connectivity test failed: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
