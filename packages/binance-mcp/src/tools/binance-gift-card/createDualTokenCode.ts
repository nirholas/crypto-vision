// src/tools/binance-gift-card/createDualTokenCode.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { giftCardClient } from "../../config/binanceClient.js";

export function registerBinanceGiftCardCreateDualTokenCode(server: McpServer) {
    server.tool(
        "BinanceGiftCardCreateDualTokenCode",
        "Create a dual-token Binance Gift Card. This creates a gift card where the base token is exchanged to the face token for redemption.",
        {
            baseToken: z.string().describe("The token used as the base for the gift card (token you pay with)"),
            faceToken: z.string().describe("The token the recipient will receive when redeeming"),
            baseTokenAmount: z.number().describe("The amount of base token to convert"),
            discount: z.number().optional().describe("Discount percentage (if applicable)"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ baseToken, faceToken, baseTokenAmount, discount, recvWindow }) => {
            try {
                const params: Record<string, any> = { baseToken, faceToken, baseTokenAmount };
                if (discount !== undefined) params.discount = discount;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await giftCardClient.createDualTokenCode(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Dual-token gift card created: ${baseTokenAmount} ${baseToken} -> ${faceToken}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to create dual-token gift card: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
