// src/tools/binance-futures-coinm/exchangeInfo.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesCOINMExchangeInfo(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMExchangeInfo",
        "Get current exchange trading rules and symbol information for COIN-M Futures.",
        {},
        async () => {
            try {
                const data = await deliveryClient.exchangeInfo();
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `COIN-M Futures exchange info retrieved. Symbols count: ${data.symbols?.length || 0}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get COIN-M Futures exchange info: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
