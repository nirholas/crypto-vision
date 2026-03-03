// src/tools/binance-sub-account/transferToMaster.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { subAccountApiClient } from "../../config/binanceClient.js";

export function registerBinanceSubAccountTransferToMaster(server: McpServer) {
    server.tool(
        "BinanceSubAccountTransferToMaster",
        "Transfer assets from sub-account to master account (SPOT). Must be called from sub-account API key.",
        {
            asset: z.string().describe("Asset to transfer (e.g., BTC, USDT)"),
            amount: z.number().describe("Amount to transfer"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ asset, amount, recvWindow }) => {
            try {
                const params: any = { asset, amount };
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await subAccountApiClient.transferToMaster(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Transferred ${amount} ${asset} to master account. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to transfer to master account: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
