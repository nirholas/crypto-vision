// src/tools/binance-wallet/asset-api/queryUserWalletBalance.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletQueryUserWalletBalance(server: McpServer) {
    server.tool(
        "BinanceWalletQueryUserWalletBalance",
        "Query user wallet balance.",
        {
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ recvWindow }) => {
            try {
                const params: any = {};
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const response = await walletClient.restAPI.queryUserWalletBalance(params);
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved user wallet balance. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve user wallet balance: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}