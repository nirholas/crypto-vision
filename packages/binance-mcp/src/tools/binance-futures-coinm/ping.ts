// src/tools/binance-futures-coinm/ping.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesCOINMPing(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMPing",
        "Test connectivity to the COIN-M Futures REST API.",
        {},
        async () => {
            try {
                const data = await deliveryClient.ping();
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `COIN-M Futures API connectivity test successful. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to ping COIN-M Futures API: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
