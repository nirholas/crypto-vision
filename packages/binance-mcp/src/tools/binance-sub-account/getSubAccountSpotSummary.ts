// src/tools/binance-sub-account/getSubAccountSpotSummary.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { subAccountApiClient } from "../../config/binanceClient.js";

export function registerBinanceSubAccountGetSpotSummary(server: McpServer) {
    server.tool(
        "BinanceSubAccountGetSpotSummary",
        "Query sub-account spot assets summary for master account.",
        {
            email: z.string().optional().describe("Sub-account email (optional, returns all if not provided)"),
            page: z.number().optional().describe("Page number, default 1"),
            size: z.number().optional().describe("Results per page, default 10, max 20"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ email, page, size, recvWindow }) => {
            try {
                const params: any = {};
                if (email !== undefined) params.email = email;
                if (page !== undefined) params.page = page;
                if (size !== undefined) params.size = size;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await subAccountApiClient.getSubAccountSpotSummary(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved sub-account spot summary. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get sub-account spot summary: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
