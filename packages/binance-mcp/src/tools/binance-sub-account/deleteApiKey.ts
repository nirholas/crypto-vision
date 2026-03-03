// src/tools/binance-sub-account/deleteApiKey.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { subAccountApiClient } from "../../config/binanceClient.js";

export function registerBinanceSubAccountDeleteApiKey(server: McpServer) {
    server.tool(
        "BinanceSubAccountDeleteApiKey",
        "Delete API key for a sub-account.",
        {
            subAccountId: z.string().describe("Sub-account ID"),
            subAccountApiKey: z.string().describe("API key to delete"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ subAccountId, subAccountApiKey, recvWindow }) => {
            try {
                const params: any = { subAccountId, subAccountApiKey };
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await subAccountApiClient.deleteSubAccountApiKey(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `API key deleted for sub-account. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to delete sub-account API key: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
