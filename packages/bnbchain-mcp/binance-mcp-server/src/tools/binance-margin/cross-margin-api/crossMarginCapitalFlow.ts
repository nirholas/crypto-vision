/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/cross-margin-api/crossMarginCapitalFlow.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginCapitalFlow(server: McpServer) {
    server.tool(
        "BinanceCrossMarginCapitalFlow",
        "Query cross margin capital flow records.",
        {
            asset: z.string().optional().describe("Asset (e.g., BTC, USDT)"),
            type: z.enum([
                "TRANSFER", "BORROW", "REPAY", "BUY_INCOME", "BUY_EXPENSE",
                "SELL_INCOME", "SELL_EXPENSE", "TRADING_COMMISSION", "BUY_LIQUIDATION",
                "SELL_LIQUIDATION", "REPAY_LIQUIDATION", "OTHER_LIQUIDATION", "LIQUIDATION_FEE",
                "SMALL_BALANCE_CONVERT", "COMMISSION_RETURN", "SMALL_LIABILITY_EXCHANGE",
                "LOAN_AUTO_REPAY", "INSURANCE_FUND_COMPENSATION"
            ]).optional().describe("Type of capital flow"),
            startTime: z.number().int().optional().describe("Start timestamp in ms"),
            endTime: z.number().int().optional().describe("End timestamp in ms"),
            fromId: z.number().int().optional().describe("ID to query from"),
            limit: z.number().int().optional().describe("Limit, default 500, max 1000"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.getCrossMarginAccountTransferHistory({
                    ...(params.asset && { asset: params.asset }),
                    ...(params.type && { type: params.type }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.fromId !== undefined && { fromId: params.fromId }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Cross Margin Capital Flow: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query capital flow: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
