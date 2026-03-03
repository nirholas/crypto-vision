/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-gift-card/redeemGiftCard.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { giftCardClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGiftCardRedeem(server: McpServer) {
    server.tool(
        "BinanceGiftCardRedeem",
        "Redeem a Binance Gift Card. The tokens will be credited to your spot wallet.",
        {
            code: z.string().describe("Gift card redemption code"),
            externalUid: z.string().optional().describe("External user ID for partner integration"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await giftCardClient.restAPI.redeemCode({
                    code: params.code,
                    ...(params.externalUid && { externalUid: params.externalUid }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Gift Card Redeemed!\n\nReference No: ${data.referenceNo}\nToken: ${data.token}\nAmount: ${data.amount}\n\nTokens have been credited to your spot wallet.`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to redeem gift card: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
