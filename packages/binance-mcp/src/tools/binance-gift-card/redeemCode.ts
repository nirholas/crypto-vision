// src/tools/binance-gift-card/redeemCode.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { giftCardClient } from "../../config/binanceClient.js";

export function registerBinanceGiftCardRedeemCode(server: McpServer) {
    server.tool(
        "BinanceGiftCardRedeemCode",
        "Redeem a Binance Gift Card code. The tokens will be credited to your account.",
        {
            code: z.string().describe("The gift card code to redeem"),
            externalUid: z.string().optional().describe("External unique identifier for the redemption"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ code, externalUid, recvWindow }) => {
            try {
                const params: Record<string, any> = { code };
                if (externalUid !== undefined) params.externalUid = externalUid;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await giftCardClient.redeemCode(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Gift card redeemed successfully. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to redeem gift card: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
