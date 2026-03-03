/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/cross-margin-api/crossMarginFee.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginFee(server: McpServer) {
    server.tool(
        "BinanceCrossMarginFee",
        "Query cross margin fee data for all assets or a specific asset.",
        {
            vipLevel: z.number().int().optional().describe("VIP level for fee tier"),
            coin: z.string().optional().describe("Specific coin to query"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.queryCrossMarginFeeData({
                    ...(params.vipLevel !== undefined && { vipLevel: params.vipLevel }),
                    ...(params.coin && { coin: params.coin }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Cross Margin Fee Data: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query margin fee: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
