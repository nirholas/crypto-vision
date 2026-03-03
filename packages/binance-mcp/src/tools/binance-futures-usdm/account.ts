// src/tools/binance-futures-usdm/account.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMAccount(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMAccount",
        "Get current USD-M Futures account information including positions and balances.",
        {},
        async () => {
            try {
                const data = await futuresClient.account();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved USD-M Futures account information. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve USD-M Futures account: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
