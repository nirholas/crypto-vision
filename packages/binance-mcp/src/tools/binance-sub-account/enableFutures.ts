// src/tools/binance-sub-account/enableFutures.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { subAccountApiClient } from "../../config/binanceClient.js";

export function registerBinanceSubAccountEnableFutures(server: McpServer) {
    server.tool(
        "BinanceSubAccountEnableFutures",
        "Enable futures trading for a sub-account.",
        {
            email: z.string().describe("Sub-account email"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ email, recvWindow }) => {
            try {
                const params: any = { email };
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await subAccountApiClient.enableFuturesForSubAccount(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Futures enabled for sub-account ${email}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to enable futures for sub-account: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
