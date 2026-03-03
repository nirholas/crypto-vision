// src/tools/binance-futures-usdm/balance.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMBalance(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMBalance",
        "Get current USD-M Futures account balance.",
        {},
        async () => {
            try {
                const data = await futuresClient.balance();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved USD-M Futures account balance. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve USD-M Futures balance: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
