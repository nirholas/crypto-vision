// src/tools/binance-gift-card/buyCode.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { giftCardClient } from "../../config/binanceClient.js";

export function registerBinanceGiftCardBuyCode(server: McpServer) {
    server.tool(
        "BinanceGiftCardBuyCode",
        "Buy a Binance Gift Card code using another token as payment. The base token is used to purchase a gift card of the face token.",
        {
            baseToken: z.string().describe("The token used to pay for the gift card (e.g., USDT)"),
            faceToken: z.string().describe("The token the gift card will contain (e.g., BNB)"),
            baseTokenAmount: z.number().describe("The amount of base token to spend"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ baseToken, faceToken, baseTokenAmount, recvWindow }) => {
            try {
                const params: Record<string, any> = { baseToken, faceToken, baseTokenAmount };
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await giftCardClient.buyCode(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Gift card purchased: ${baseTokenAmount} ${baseToken} -> ${faceToken}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to buy gift card: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
