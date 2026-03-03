// src/tools/binance-margin/cross-margin-api/crossMarginCapitalFlow.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginCapitalFlow(server: McpServer) {
    server.tool(
        "BinanceCrossMarginCapitalFlow",
        "Get cross margin capital flow history including transfers, borrows, repays, and interest.",
        {
            asset: z.string().optional().describe("Filter by asset symbol"),
            symbol: z.string().optional().describe("Filter by trading pair symbol"),
            type: z.enum(["TRANSFER_IN", "TRANSFER_OUT", "BORROW", "REPAY", "BUY_INCOME", "SELL_LOSS", "TRADING_COMMISSION", "LIQUIDATION", "INTEREST", "SMALL_LIABILITY_EXCHANGE", "SMALL_ASSETS_EXCHANGE"]).optional().describe("Type of capital flow"),
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            fromId: z.number().int().optional().describe("Start from ID"),
            limit: z.number().int().optional().describe("Number of results (default 500, max 1000)"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.getCapitalFlow({
                    ...(params.asset && { asset: params.asset }),
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.type && { type: params.type }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.fromId && { fromId: params.fromId }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Cross Margin Capital Flow: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get capital flow: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
