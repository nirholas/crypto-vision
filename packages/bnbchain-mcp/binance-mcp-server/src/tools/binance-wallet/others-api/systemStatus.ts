/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-wallet/others-api/systemStatus.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletSystemStatus(server: McpServer) {
    server.tool(
        "BinanceWalletSystemStatus",
        "Get Binance Wallet system status.",
        {},
        async () => {
            try {
                const response = await walletClient.restAPI.systemStatus();
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved system status. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve system status: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}