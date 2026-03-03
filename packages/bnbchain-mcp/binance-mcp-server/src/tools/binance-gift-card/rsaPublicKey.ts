/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-gift-card/rsaPublicKey.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { giftCardClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGiftCardRsaPublicKey(server: McpServer) {
    server.tool(
        "BinanceGiftCardRsaPublicKey",
        "Get RSA public key for encrypting gift card codes in external integrations.",
        {
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await giftCardClient.restAPI.rsaPublicKey({
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `🔐 RSA Public Key for Gift Card Encryption\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get RSA public key: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
