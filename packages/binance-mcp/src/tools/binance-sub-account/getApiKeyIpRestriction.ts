// src/tools/binance-sub-account/getApiKeyIpRestriction.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { subAccountApiClient } from "../../config/binanceClient.js";

export function registerBinanceSubAccountGetApiKeyIpRestriction(server: McpServer) {
    server.tool(
        "BinanceSubAccountGetApiKeyIpRestriction",
        "Get IP restriction for a sub-account API key.",
        {
            subAccountId: z.string().describe("Sub-account ID"),
            subAccountApiKey: z.string().describe("Sub-account API key"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ subAccountId, subAccountApiKey, recvWindow }) => {
            try {
                const params: any = { subAccountId, subAccountApiKey };
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await subAccountApiClient.getSubAccountApiKeyIpRestriction(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved IP restriction for sub-account API key. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get IP restriction: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
