// src/tools/binance-sub-account/updateIpRestriction.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { subAccountApiClient } from "../../config/binanceClient.js";

export function registerBinanceSubAccountUpdateIpRestriction(server: McpServer) {
    server.tool(
        "BinanceSubAccountUpdateIpRestriction",
        "Update IP restriction for a sub-account API key.",
        {
            subAccountId: z.string().describe("Sub-account ID"),
            subAccountApiKey: z.string().describe("Sub-account API key"),
            status: z.string().describe("IP restriction status: 1 - Restrict by IP, 2 - Unrestrict"),
            ipAddress: z.string().optional().describe("IP address (comma-separated for multiple)"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ subAccountId, subAccountApiKey, status, ipAddress, recvWindow }) => {
            try {
                const params: any = { subAccountId, subAccountApiKey, status };
                if (ipAddress !== undefined) params.ipAddress = ipAddress;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await subAccountApiClient.updateSubAccountApiKeyIpRestriction(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `IP restriction updated for sub-account API key. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to update IP restriction: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
