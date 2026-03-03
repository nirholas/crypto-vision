// src/tools/binance-futures-coinm/income.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deliveryClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesCOINMIncome(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMIncome",
        "Get income history for COIN-M Futures.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (e.g., BTCUSD_PERP)"),
            incomeType: z.enum(["TRANSFER", "WELCOME_BONUS", "REALIZED_PNL", "FUNDING_FEE", "COMMISSION", "INSURANCE_CLEAR", "REFERRAL_KICKBACK", "COMMISSION_REBATE", "DELIVERED_SETTELMENT", "COIN_SWAP_DEPOSIT", "COIN_SWAP_WITHDRAW"]).optional().describe("Income type"),
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

                const data = await deliveryClient.income(params);
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved ${data.length || 0} COIN-M Futures income records. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve COIN-M Futures income: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
