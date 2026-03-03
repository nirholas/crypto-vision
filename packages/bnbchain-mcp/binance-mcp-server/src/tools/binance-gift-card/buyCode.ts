/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-gift-card/buyCode.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { giftCardClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGiftCardBuyCode(server: McpServer) {
    server.tool(
        "BinanceGiftCardBuyCode",
        "Buy a Binance Gift Card code with a specific token. You can buy gift cards using one token to create a card for another token.",
        {
            baseToken: z.string().describe("Token used to pay for the gift card (e.g., 'USDT')"),
            faceToken: z.string().describe("Token that the recipient will receive (e.g., 'BNB')"),
            baseTokenAmount: z.string().describe("Amount of base token to spend"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await giftCardClient.restAPI.buyCode({
                    baseToken: params.baseToken,
                    faceToken: params.faceToken,
                    baseTokenAmount: params.baseTokenAmount,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Gift Card Purchased!\n\nReference No: ${data.referenceNo}\nCode: ${data.code}\nPaid: ${params.baseTokenAmount} ${params.baseToken}\nGift Card Value: ${data.faceTokenAmount || 'N/A'} ${params.faceToken}\n\n⚠️ Keep the code secure!`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to buy gift card: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
