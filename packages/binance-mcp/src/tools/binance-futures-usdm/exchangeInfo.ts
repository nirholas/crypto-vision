// src/tools/binance-futures-usdm/exchangeInfo.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMExchangeInfo(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMExchangeInfo",
        "Get current exchange trading rules and symbol information for USD-M Futures.",
        {},
        async () => {
            try {
                const data = await futuresClient.exchangeInfo();
                return {
                    content: [
                        {
                            type: "text",
                            text: `USD-M Futures exchange info retrieved. Symbols count: ${data.symbols?.length || 0}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get USD-M Futures exchange info: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
