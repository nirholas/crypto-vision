// src/tools/binance-futures-usdm/time.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMTime(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMTime",
        "Get the current server time from the USD-M Futures API.",
        {},
        async () => {
            try {
                const data = await futuresClient.time();
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `USD-M Futures server time: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get USD-M Futures server time: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
