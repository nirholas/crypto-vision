// src/tools/binance-margin/cross-margin-api/crossMarginForceLiquidationRec.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginForceLiquidationRec(server: McpServer) {
    server.tool(
        "BinanceCrossMarginForceLiquidationRec",
        "Get force liquidation record for margin account. Shows historical liquidation events.",
        {
            isolatedSymbol: z.string().optional().describe("Isolated symbol for isolated margin"),
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            current: z.number().int().optional().describe("Current page (default 1)"),
            size: z.number().int().optional().describe("Page size (default 10, max 100)"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.getForceLiquidationRecord({
                    ...(params.isolatedSymbol && { isolatedSymbol: params.isolatedSymbol }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.current && { current: params.current }),
                    ...(params.size && { size: params.size }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Force Liquidation Records: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get liquidation records: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
