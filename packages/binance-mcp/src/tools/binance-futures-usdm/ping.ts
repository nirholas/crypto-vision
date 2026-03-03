// src/tools/binance-futures-usdm/ping.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMPing(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMPing",
        "Test connectivity to the USD-M Futures REST API.",
        {},
        async () => {
            try {
                const data = await futuresClient.ping();
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `USD-M Futures API connectivity test successful. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to ping USD-M Futures API: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
