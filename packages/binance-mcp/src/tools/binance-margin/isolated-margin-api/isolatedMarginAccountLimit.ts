// src/tools/binance-margin/isolated-margin-api/isolatedMarginAccountLimit.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceIsolatedMarginAccountLimit(server: McpServer) {
    server.tool(
        "BinanceIsolatedMarginAccountLimit",
        "Query the maximum number of isolated margin accounts allowed and currently enabled.",
        {
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.getIsolatedAccount({
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Isolated Margin Account Limit: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query account limit: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
