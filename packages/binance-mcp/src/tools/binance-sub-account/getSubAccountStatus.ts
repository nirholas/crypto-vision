// src/tools/binance-sub-account/getSubAccountStatus.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { subAccountApiClient } from "../../config/binanceClient.js";

export function registerBinanceSubAccountGetStatus(server: McpServer) {
    server.tool(
        "BinanceSubAccountGetStatus",
        "Get sub-account status including enable/disable status for margin and futures.",
        {
            email: z.string().optional().describe("Sub-account email (optional)"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ email, recvWindow }) => {
            try {
                const params: any = {};
                if (email !== undefined) params.email = email;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await subAccountApiClient.getSubAccountStatus(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved sub-account status. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get sub-account status: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
