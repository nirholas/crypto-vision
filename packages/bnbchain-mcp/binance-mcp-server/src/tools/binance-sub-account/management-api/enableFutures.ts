/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-sub-account/management-api/enableFutures.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spotClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceSubAccountEnableFutures(server: McpServer) {
    server.tool(
        "BinanceSubAccountEnableFutures",
        "Enable futures trading for a sub-account. ⚠️ WARNING: Futures trading involves leverage and carries significant risk of total loss. Only enable if you understand the risks.",
        {
            email: z.string().email()
                .describe("Sub-account email to enable futures for"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await spotClient.restAPI.enableFuturesForSubAccount({
                    email: params.email,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `✅ Futures trading enabled for sub-account: ${params.email}\n\nResponse: ${JSON.stringify(data, null, 2)}\n\n⚠️ Reminder: Futures trading carries significant risk of total loss.`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to enable futures: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
