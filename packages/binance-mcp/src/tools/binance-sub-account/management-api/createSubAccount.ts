/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-sub-account/management-api/createSubAccount.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spotClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceSubAccountCreate(server: McpServer) {
    server.tool(
        "BinanceSubAccountCreate",
        "Create a new virtual sub-account under your master account. Sub-accounts are useful for separating trading strategies or managing funds for different purposes. ⚠️ Requires master account permissions.",
        {
            subAccountString: z.string().min(1).max(20)
                .describe("Sub-account name/label (1-20 characters, alphanumeric)"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await spotClient.restAPI.createVirtualSubAccount({
                    subAccountString: params.subAccountString,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `✅ Sub-account created successfully!\n\nEmail: ${data.email}\n\n📝 Note: The sub-account email is auto-generated. Use it for API operations and transfers.`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to create sub-account: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
