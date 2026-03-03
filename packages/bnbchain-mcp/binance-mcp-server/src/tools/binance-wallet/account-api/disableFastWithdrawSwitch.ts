/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-wallet/account-api/disableFastWithdrawSwitch.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletDisableFastWithdrawSwitch(server: McpServer) {
    server.tool(
        "BinanceWalletDisableFastWithdrawSwitch",
        "Disable fast withdraw switch.",
        {
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ recvWindow }) => {
            try {
                const params: any = {};
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const response = await walletClient.restAPI.disableFastWithdrawSwitch(params);
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Disabled fast withdraw switch. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to disable fast withdraw switch: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}