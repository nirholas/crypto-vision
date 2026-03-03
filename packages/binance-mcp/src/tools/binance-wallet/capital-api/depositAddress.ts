// src/tools/binance-wallet/capital-api/depositAddress.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletDepositAddress(server: McpServer) {
    server.tool(
        "BinanceWalletDepositAddress",
        "Get deposit address for a specific coin.",
        {
            coin: z.string().describe("Coin symbol"),
            network: z.string().optional().describe("Network"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ coin, network, recvWindow }) => {
            try {
                const params: any = { coin };
                if (network !== undefined) params.network = network;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const response = await walletClient.restAPI.depositAddress(params);
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved deposit address for ${coin}. Address: ${data.address}${data.tag ? `, Tag: ${data.tag}` : ''}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve deposit address: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}