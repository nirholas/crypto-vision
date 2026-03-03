// src/tools/binance-sub-account/getSubAccountMarginSummary.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { subAccountApiClient } from "../../config/binanceClient.js";

export function registerBinanceSubAccountGetMarginSummary(server: McpServer) {
    server.tool(
        "BinanceSubAccountGetMarginSummary",
        "Query sub-account margin account summary.",
        {
            email: z.string().optional().describe("Sub-account email (optional)"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ email, recvWindow }) => {
            try {
                const params: any = {};
                if (email !== undefined) params.email = email;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await subAccountApiClient.getSubAccountMarginSummary(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved sub-account margin summary. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get sub-account margin summary: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
