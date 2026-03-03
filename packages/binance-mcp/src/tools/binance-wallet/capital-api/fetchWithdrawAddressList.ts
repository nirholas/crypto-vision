// src/tools/binance-wallet/capital-api/fetchWithdrawAddressList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletFetchWithdrawAddressList(server: McpServer) {
    server.tool(
        "BinanceWalletFetchWithdrawAddressList",
        "Fetch withdraw address list.",
        {
        },
        async () => {
            try {
                
                const response = await walletClient.restAPI.fetchWithdrawAddressList();
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved withdraw address list. Total addresses: ${data || 0}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve withdraw address list: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}