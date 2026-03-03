/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/cross-margin-api/crossMarginMaxTransferable.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginMaxTransferable(server: McpServer) {
    server.tool(
        "BinanceCrossMarginMaxTransferable",
        "Query maximum transferable amount for an asset in Cross Margin.",
        {
            asset: z.string().describe("Asset (e.g., BTC, USDT)"),
            isolatedSymbol: z.string().optional().describe("Isolated symbol"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.queryMaxTransferOutAmount({
                    asset: params.asset,
                    ...(params.isolatedSymbol && { isolatedSymbol: params.isolatedSymbol }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Max Transferable for ${params.asset}: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query max transferable: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
