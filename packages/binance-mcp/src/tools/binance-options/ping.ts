// src/tools/binance-options/ping.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsPing(server: McpServer) {
    server.tool(
        "BinanceOptionsPing",
        "Test connectivity to the Binance Options API.",
        {},
        async () => {
            try {
                const data = await optionsClient.ping();
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Options API connectivity test successful. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Options API connectivity test failed: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
