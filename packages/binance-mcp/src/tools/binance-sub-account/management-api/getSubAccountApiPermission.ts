/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-sub-account/management-api/getSubAccountApiPermission.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spotClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceSubAccountApiPermission(server: McpServer) {
    server.tool(
        "BinanceSubAccountApiPermission",
        "Get API key permissions for a sub-account. Shows what operations the API key is allowed to perform.",
        {
            email: z.string().email()
                .describe("Sub-account email to query API permissions for"),
            subAccountApiKey: z.string()
                .describe("Sub-account API key to check permissions for"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await spotClient.restAPI.getSubAccountApiIpRestriction({
                    email: params.email,
                    subAccountApiKey: params.subAccountApiKey,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `Sub-Account API Permissions:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get API permissions: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
