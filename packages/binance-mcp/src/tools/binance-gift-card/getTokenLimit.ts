// src/tools/binance-gift-card/getTokenLimit.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { giftCardClient } from "../../config/binanceClient.js";

export function registerBinanceGiftCardGetTokenLimit(server: McpServer) {
    server.tool(
        "BinanceGiftCardGetTokenLimit",
        "Fetch the token limits for buying gift cards, including minimum and maximum amounts.",
        {
            baseToken: z.string().describe("The base token to check limits for (e.g., USDT)"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ baseToken, recvWindow }) => {
            try {
                const params: Record<string, any> = { baseToken };
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await giftCardClient.getTokenLimit(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Token limit for ${baseToken}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to fetch token limit: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
