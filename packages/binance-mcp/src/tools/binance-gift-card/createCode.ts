// src/tools/binance-gift-card/createCode.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { giftCardClient } from "../../config/binanceClient.js";

export function registerBinanceGiftCardCreateCode(server: McpServer) {
    server.tool(
        "BinanceGiftCardCreateCode",
        "Create a Binance Gift Card code. This allows you to generate a gift card with a specified token and amount.",
        {
            token: z.string().describe("The token to include in the gift card (e.g., BNB, USDT)"),
            amount: z.number().describe("The amount of the token to include in the gift card"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ token, amount, recvWindow }) => {
            try {
                const params: Record<string, any> = { token, amount };
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await giftCardClient.createCode(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Gift card code created successfully for ${amount} ${token}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to create gift card code: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
