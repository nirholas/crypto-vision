// src/tools/binance-futures-usdm/income.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMIncome(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMIncome",
        "Get income history for USD-M Futures.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            incomeType: z.enum(["TRANSFER", "WELCOME_BONUS", "REALIZED_PNL", "FUNDING_FEE", "COMMISSION", "INSURANCE_CLEAR", "REFERRAL_KICKBACK", "COMMISSION_REBATE", "API_REBATE", "CONTEST_REWARD", "CROSS_COLLATERAL_TRANSFER", "OPTIONS_PREMIUM_FEE", "OPTIONS_SETTLE_PROFIT", "INTERNAL_TRANSFER", "AUTO_EXCHANGE", "DELIVERED_SETTELMENT", "COIN_SWAP_DEPOSIT", "COIN_SWAP_WITHDRAW", "POSITION_LIMIT_INCREASE_FEE"]).optional().describe("Income type"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            limit: z.number().optional().describe("Default 100; max 1000")
        },
        async ({ symbol, incomeType, startTime, endTime, limit }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;
                if (incomeType) params.incomeType = incomeType;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (limit !== undefined) params.limit = limit;

                const data = await futuresClient.income(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved ${data.length || 0} USD-M Futures income records. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve USD-M Futures income: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
