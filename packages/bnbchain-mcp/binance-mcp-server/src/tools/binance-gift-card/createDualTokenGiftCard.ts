/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-gift-card/createDualTokenGiftCard.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { giftCardClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGiftCardCreateDualToken(server: McpServer) {
    server.tool(
        "BinanceGiftCardCreateDualToken",
        "Create a dual-token Binance Gift Card. Allows creating a gift card using one token that the recipient will receive as another token.",
        {
            baseToken: z.string().describe("Token used to pay for the gift card (e.g., 'USDT')"),
            faceToken: z.string().describe("Token that the recipient will receive (e.g., 'BNB')"),
            baseTokenAmount: z.string().describe("Amount of base token to spend"),
            discount: z.number().optional().describe("Discount rate (0-100)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await giftCardClient.restAPI.createDualTokenCode({
                    baseToken: params.baseToken,
                    faceToken: params.faceToken,
                    baseTokenAmount: params.baseTokenAmount,
                    ...(params.discount !== undefined && { discount: params.discount }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Dual-Token Gift Card Created!\n\nReference No: ${data.referenceNo}\nCode: ${data.code}\nPaid: ${params.baseTokenAmount} ${params.baseToken}\nRecipient Gets: ${data.faceTokenAmount || 'N/A'} ${params.faceToken}\n\n⚠️ Keep the code secure!`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to create dual-token gift card: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
