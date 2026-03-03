// src/tools/binance-sub-account/getSubAccountDepositAddress.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { subAccountApiClient } from "../../config/binanceClient.js";

export function registerBinanceSubAccountGetDepositAddress(server: McpServer) {
    server.tool(
        "BinanceSubAccountGetDepositAddress",
        "Get sub-account deposit address for a specific coin.",
        {
            email: z.string().describe("Sub-account email"),
            coin: z.string().describe("Coin to get deposit address for (e.g., BTC, ETH)"),
            network: z.string().optional().describe("Network to use (e.g., BTC, ETH, BSC)"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ email, coin, network, recvWindow }) => {
            try {
                const params: any = { email, coin };
                if (network !== undefined) params.network = network;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await subAccountApiClient.getSubAccountDepositAddress(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved deposit address for ${coin} on ${email}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get sub-account deposit address: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
