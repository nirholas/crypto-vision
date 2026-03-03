// src/tools/binance-wallet/others-api/getSymbolsDelistScheduleForSpot.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletGetSymbolsDelistScheduleForSpot(server: McpServer) {
    server.tool(
        "BinanceWalletGetSymbolsDelistScheduleForSpot",
        "Get delist schedule for spot symbols.",
        {},
        async () => {
            try {
                const response = await walletClient.restAPI.getSymbolsDelistScheduleForSpot();
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved delist schedule for spot symbols. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve delist schedule: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}