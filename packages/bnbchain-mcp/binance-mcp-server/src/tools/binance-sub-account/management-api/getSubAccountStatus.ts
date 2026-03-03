/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-sub-account/management-api/getSubAccountStatus.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spotClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceSubAccountStatus(server: McpServer) {
    server.tool(
        "BinanceSubAccountStatus",
        "Get the status of a sub-account including enabled features (margin, futures, etc.) and trading permissions.",
        {
            email: z.string().email().optional()
                .describe("Sub-account email to query"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await spotClient.restAPI.getSubAccountStatus({
                    ...(params.email && { email: params.email }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `Sub-Account Status:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get sub-account status: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
