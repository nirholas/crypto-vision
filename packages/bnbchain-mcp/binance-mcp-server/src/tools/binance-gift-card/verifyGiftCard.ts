/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-gift-card/verifyGiftCard.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { giftCardClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGiftCardVerify(server: McpServer) {
    server.tool(
        "BinanceGiftCardVerify",
        "Verify a Binance Gift Card code. Check if the code is valid and see its details before redeeming.",
        {
            referenceNo: z.string().describe("Gift card reference number"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await giftCardClient.restAPI.verify({
                    referenceNo: params.referenceNo,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let statusText = "Unknown";
                if (data.valid === true) statusText = "✅ Valid";
                else if (data.valid === false) statusText = "❌ Invalid/Used";
                
                return {
                    content: [{
                        type: "text",
                        text: `🎁 Gift Card Verification\n\nReference No: ${params.referenceNo}\nStatus: ${statusText}\nToken: ${data.token || 'N/A'}\nAmount: ${data.amount || 'N/A'}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to verify gift card: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
