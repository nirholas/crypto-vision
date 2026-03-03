// src/tools/binance-margin/cross-margin-api/crossMarginSmallLiabilityExchange.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginSmallLiabilityExchange(server: McpServer) {
    server.tool(
        "BinanceCrossMarginSmallLiabilityExchange",
        "Cross margin small liability exchange. Converts small liabilities to a single asset.",
        {
            assetNames: z.array(z.string()).describe("Array of asset names to exchange (e.g., ['BTC', 'ETH'])"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.smallLiabilityExchange({
                    assetNames: params.assetNames.join(","),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Small liability exchange completed: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to exchange small liability: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
