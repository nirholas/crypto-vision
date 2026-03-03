// src/tools/binance-sub-account/createVirtualSubAccount.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { subAccountApiClient } from "../../config/binanceClient.js";

export function registerBinanceSubAccountCreateVirtual(server: McpServer) {
    server.tool(
        "BinanceSubAccountCreateVirtual",
        "Create a virtual sub-account under the master account. Requires master account API key.",
        {
            subAccountString: z.string().describe("The email address for the virtual sub-account"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ subAccountString, recvWindow }) => {
            try {
                const params: any = { subAccountString };
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await subAccountApiClient.createVirtualSubAccount(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Virtual sub-account created: ${subAccountString}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to create virtual sub-account: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
