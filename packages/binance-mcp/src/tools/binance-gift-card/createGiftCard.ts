/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-gift-card/createGiftCard.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { giftCardClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGiftCardCreate(server: McpServer) {
    server.tool(
        "BinanceGiftCardCreate",
        "Create a Binance Gift Card. The card will be deducted from your spot wallet balance.",
        {
            token: z.string().describe("Token type (e.g., 'BNB', 'USDT', 'BTC')"),
            amount: z.string().describe("Amount of tokens to include in gift card"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await giftCardClient.restAPI.createCode({
                    token: params.token,
                    amount: params.amount,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Gift Card Created!\n\nReference No: ${data.referenceNo}\nCode: ${data.code}\nToken: ${params.token}\nAmount: ${params.amount}\n\n⚠️ Keep the code secure! Anyone with the code can redeem it.`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to create gift card: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
