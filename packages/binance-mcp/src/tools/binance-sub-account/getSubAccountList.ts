// src/tools/binance-sub-account/getSubAccountList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { subAccountApiClient } from "../../config/binanceClient.js";

export function registerBinanceSubAccountGetList(server: McpServer) {
    server.tool(
        "BinanceSubAccountGetList",
        "Query the list of sub-accounts under the master account.",
        {
            email: z.string().optional().describe("Sub-account email to filter"),
            isFreeze: z.string().optional().describe("Filter by freeze status: 'true' or 'false'"),
            page: z.number().optional().describe("Page number, default 1"),
            limit: z.number().optional().describe("Results per page, default 1, max 200"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ email, isFreeze, page, limit, recvWindow }) => {
            try {
                const params: any = {};
                if (email !== undefined) params.email = email;
                if (isFreeze !== undefined) params.isFreeze = isFreeze;
                if (page !== undefined) params.page = page;
                if (limit !== undefined) params.limit = limit;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await subAccountApiClient.getSubAccountList(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved sub-account list. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get sub-account list: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
