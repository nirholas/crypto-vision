// src/tools/binance-wallet/account-api/enableFastWithdrawSwitch.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletEnableFastWithdrawSwitch(server: McpServer) {
    server.tool(
        "BinanceWalletEnableFastWithdrawSwitch",
        "Enable fast withdraw switch.",
        {
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ recvWindow }) => {
            try {
                const params: any = {};
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const response = await walletClient.restAPI.enableFastWithdrawSwitch(params);
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Enabled fast withdraw switch. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to enable fast withdraw switch: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}