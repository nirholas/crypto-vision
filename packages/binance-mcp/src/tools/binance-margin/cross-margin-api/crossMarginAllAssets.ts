/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-margin/cross-margin-api/crossMarginAllAssets.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginAllAssets(server: McpServer) {
    server.tool(
        "BinanceCrossMarginAllAssets",
        "Get all assets available for cross margin trading, including borrowable status, daily interest rates, and limits.",
        {
            asset: z.string().optional().describe("Specific asset to query (e.g., BTC, USDT). If not provided, returns all assets."),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.getAllCrossMarginPairs({
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                
                // If specific asset requested, filter results
                let result = data;
                if (params.asset && Array.isArray(data)) {
                    result = data.filter((item: any) => 
                        item.base === params.asset || item.quote === params.asset
                    );
                }

                return {
                    content: [{
                        type: "text",
                        text: `Cross Margin Assets: ${JSON.stringify(result, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query cross margin assets: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
