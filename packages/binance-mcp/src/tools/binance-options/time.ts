// src/tools/binance-options/time.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsTime(server: McpServer) {
    server.tool(
        "BinanceOptionsTime",
        "Get the current server time from Binance Options API.",
        {},
        async () => {
            try {
                const data = await optionsClient.time();
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Server time retrieved successfully. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get server time: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
