// src/tools/binance-sub-account/createApiKey.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { subAccountApiClient } from "../../config/binanceClient.js";

export function registerBinanceSubAccountCreateApiKey(server: McpServer) {
    server.tool(
        "BinanceSubAccountCreateApiKey",
        "Create API key for a sub-account.",
        {
            subAccountId: z.string().describe("Sub-account ID"),
            canTrade: z.boolean().describe("Enable spot and margin trading"),
            marginTrade: z.boolean().optional().describe("Enable margin loan, repay and transfer"),
            futuresTrade: z.boolean().optional().describe("Enable futures trading"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ subAccountId, canTrade, marginTrade, futuresTrade, recvWindow }) => {
            try {
                const params: any = { subAccountId, canTrade };
                if (marginTrade !== undefined) params.marginTrade = marginTrade;
                if (futuresTrade !== undefined) params.futuresTrade = futuresTrade;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await subAccountApiClient.createSubAccountApiKey(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `API key created for sub-account. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to create sub-account API key: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
