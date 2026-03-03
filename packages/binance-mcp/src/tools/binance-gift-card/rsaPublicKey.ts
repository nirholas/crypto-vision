// src/tools/binance-gift-card/rsaPublicKey.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { giftCardClient } from "../../config/binanceClient.js";

export function registerBinanceGiftCardRsaPublicKey(server: McpServer) {
    server.tool(
        "BinanceGiftCardRsaPublicKey",
        "Fetch the RSA public key for encrypting gift card codes.",
        {
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ recvWindow }) => {
            try {
                const params: Record<string, any> = {};
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await giftCardClient.rsaPublicKey(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved RSA public key. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to fetch RSA public key: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
