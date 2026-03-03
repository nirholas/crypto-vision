/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-sub-account/management-api/enableMargin.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spotClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceSubAccountEnableMargin(server: McpServer) {
    server.tool(
        "BinanceSubAccountEnableMargin",
        "Enable margin trading for a sub-account. ⚠️ WARNING: Margin trading involves leverage and carries significant risk of loss. Only enable if you understand the risks.",
        {
            email: z.string().email()
                .describe("Sub-account email to enable margin for"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await spotClient.restAPI.enableMarginForSubAccount({
                    email: params.email,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `✅ Margin trading enabled for sub-account: ${params.email}\n\nResponse: ${JSON.stringify(data, null, 2)}\n\n⚠️ Reminder: Margin trading carries significant risk.`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to enable margin: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
