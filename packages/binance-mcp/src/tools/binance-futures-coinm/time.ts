// src/tools/binance-futures-coinm/time.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesCOINMTime(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMTime",
        "Get the current server time from the COIN-M Futures API.",
        {},
        async () => {
            try {
                const data = await deliveryClient.time();
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `COIN-M Futures server time: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get COIN-M Futures server time: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
