/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/cross-margin-api/crossMarginForceLiquidationRec.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginForceLiquidationRec(server: McpServer) {
    server.tool(
        "BinanceCrossMarginForceLiquidationRec",
        "Query force liquidation records in Cross Margin account.",
        {
            startTime: z.number().int().optional().describe("Start timestamp in ms"),
            endTime: z.number().int().optional().describe("End timestamp in ms"),
            isolatedSymbol: z.string().optional().describe("Isolated symbol for isolated margin"),
            current: z.number().int().optional().describe("Current page, default 1"),
            size: z.number().int().optional().describe("Page size, default 10, max 100"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.getForceLiquidationRecord({
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.isolatedSymbol && { isolatedSymbol: params.isolatedSymbol }),
                    ...(params.current && { current: params.current }),
                    ...(params.size && { size: params.size }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Force Liquidation Records: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query liquidation records: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
