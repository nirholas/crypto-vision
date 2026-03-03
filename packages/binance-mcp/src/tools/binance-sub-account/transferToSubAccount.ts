// src/tools/binance-sub-account/transferToSubAccount.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { subAccountApiClient } from "../../config/binanceClient.js";

export function registerBinanceSubAccountTransferToSub(server: McpServer) {
    server.tool(
        "BinanceSubAccountTransferToSub",
        "Transfer assets from master account to sub-account (SPOT).",
        {
            toEmail: z.string().describe("Sub-account email to transfer to"),
            asset: z.string().describe("Asset to transfer (e.g., BTC, USDT)"),
            amount: z.number().describe("Amount to transfer"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ toEmail, asset, amount, recvWindow }) => {
            try {
                const params: any = { toEmail, asset, amount };
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await subAccountApiClient.transferToSubAccount(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Transferred ${amount} ${asset} to ${toEmail}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to transfer to sub-account: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
