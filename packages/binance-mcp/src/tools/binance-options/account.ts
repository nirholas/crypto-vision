// src/tools/binance-options/account.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsAccount(server: McpServer) {
    server.tool(
        "BinanceOptionsAccount",
        "Get current options account information.",
        {},
        async () => {
            try {
                const data = await optionsClient.account();
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Options account information retrieved. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get account info: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
