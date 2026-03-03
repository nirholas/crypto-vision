// src/tools/binance-gift-card/verify.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { giftCardClient } from "../../config/binanceClient.js";

export function registerBinanceGiftCardVerify(server: McpServer) {
    server.tool(
        "BinanceGiftCardVerify",
        "Verify a Binance Gift Card code to check its validity and status without redeeming it.",
        {
            referenceNo: z.string().describe("The reference number of the gift card to verify"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ referenceNo, recvWindow }) => {
            try {
                const params: Record<string, any> = { referenceNo };
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await giftCardClient.verify(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Gift card verification result. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to verify gift card: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
