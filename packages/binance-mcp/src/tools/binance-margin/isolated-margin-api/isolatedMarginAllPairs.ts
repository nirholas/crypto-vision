// src/tools/binance-margin/isolated-margin-api/isolatedMarginAllPairs.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceIsolatedMarginAllPairs(server: McpServer) {
    server.tool(
        "BinanceIsolatedMarginAllPairs",
        "Get all isolated margin trading pairs with their information.",
        {
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.getIsolatedMarginPairs({
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `All Isolated Margin Pairs: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get isolated pairs: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
