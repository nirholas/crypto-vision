/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/cross-margin-api/crossMarginSmallLiabilityExchange.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginSmallLiabilityExchange(server: McpServer) {
    server.tool(
        "BinanceCrossMarginSmallLiabilityExchange",
        "Convert small liabilities to BNB in Cross Margin account.",
        {
            assetNames: z.array(z.string()).describe("Array of asset names to exchange"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.crossMarginSmallLiabilityExchange({
                    assetNames: params.assetNames,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Small Liability Exchange Result: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to exchange small liabilities: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
