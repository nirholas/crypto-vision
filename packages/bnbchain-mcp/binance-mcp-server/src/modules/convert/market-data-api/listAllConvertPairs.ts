/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-convert/market-data-api/listAllConvertPairs.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { convertClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceConvertGetListAllConvertPairs(server: McpServer) {
    server.tool(
        "BinanceConvertGetListAllConvertPairs",
        "Query available conversion pairs (like BTC to USDT), and shows the minimum and maximum allowed amounts for both the source and destination tokens.",
        {
            fromAsset: z.string().optional().describe("User spends coin"),
            toAsset: z.string().optional().describe("User receives coin")
        },
        async (params) => {
            try {
                const response = await convertClient.restAPI.listAllConvertPairs({
                    ...(params.fromAsset && { fromAsset: params.fromAsset }),
                    ...(params.toAsset && { toAsset: params.toAsset })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully queried available conversion pairs. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to query available conversion pairs: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
