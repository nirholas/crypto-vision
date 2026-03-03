/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/account-api/income.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesIncome(server: McpServer) {
    server.tool(
        "BinanceFuturesIncome",
        "Get income history for USD-M Futures account.",
        {
            symbol: z.string().optional().describe("Futures symbol"),
            incomeType: z.enum([
                "TRANSFER", "WELCOME_BONUS", "REALIZED_PNL", "FUNDING_FEE",
                "COMMISSION", "INSURANCE_CLEAR", "REFERRAL_KICKBACK", "COMMISSION_REBATE",
                "API_REBATE", "CONTEST_REWARD", "CROSS_COLLATERAL_TRANSFER", "OPTIONS_PREMIUM_FEE",
                "OPTIONS_SETTLE_PROFIT", "INTERNAL_TRANSFER", "AUTO_EXCHANGE", "DELIVERED_SETTELMENT",
                "COIN_SWAP_DEPOSIT", "COIN_SWAP_WITHDRAW", "POSITION_LIMIT_INCREASE_FEE"
            ]).optional().describe("Type of income"),
            startTime: z.number().int().optional().describe("Start timestamp in ms"),
            endTime: z.number().int().optional().describe("End timestamp in ms"),
            limit: z.number().int().optional().describe("Number of results. Default 100, max 1000"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.income({
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.incomeType && { incomeType: params.incomeType }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Income History: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get income history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
