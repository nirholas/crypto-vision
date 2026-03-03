/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-gift-card/redeemDualTokenGiftCard.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { giftCardClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGiftCardRedeemDualToken(server: McpServer) {
    server.tool(
        "BinanceGiftCardRedeemDualToken",
        "Redeem a dual-token Binance Gift Card.",
        {
            code: z.string().describe("Gift card redemption code"),
            externalUid: z.string().optional().describe("External user ID for partner integration"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await giftCardClient.restAPI.redeemDualTokenCode({
                    code: params.code,
                    ...(params.externalUid && { externalUid: params.externalUid }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Dual-Token Gift Card Redeemed!\n\nReference No: ${data.referenceNo}\nToken Received: ${data.token}\nAmount: ${data.amount}\n\nTokens have been credited to your spot wallet.`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to redeem dual-token gift card: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
