// src/tools/binance-sub-account/getSubAccountAssets.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { subAccountApiClient } from "../../config/binanceClient.js";

export function registerBinanceSubAccountGetAssets(server: McpServer) {
    server.tool(
        "BinanceSubAccountGetAssets",
        "Query sub-account assets (balances).",
        {
            email: z.string().describe("Sub-account email"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ email, recvWindow }) => {
            try {
                const params: any = { email };
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await subAccountApiClient.getSubAccountAssets(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved assets for sub-account ${email}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get sub-account assets: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
