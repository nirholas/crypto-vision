/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/account-api/income.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryIncome(server: McpServer) {
    server.tool(
        "BinanceDeliveryIncome",
        "Get COIN-M Futures income history including realized PnL, funding fees, commissions, etc.",
        {
            symbol: z.string().optional().describe("Contract symbol filter"),
            incomeType: z.enum([
                "TRANSFER", "WELCOME_BONUS", "REALIZED_PNL", "FUNDING_FEE", 
                "COMMISSION", "INSURANCE_CLEAR", "REFERRAL_KICKBACK", 
                "COMMISSION_REBATE", "DELIVERED_SETTELMENT", "COIN_SWAP_DEPOSIT", "COIN_SWAP_WITHDRAW"
            ]).optional().describe("Income type filter"),
            startTime: z.number().int().optional().describe("Start timestamp in milliseconds"),
            endTime: z.number().int().optional().describe("End timestamp in milliseconds"),
            limit: z.number().int().optional().describe("Number of results (default 100, max 1000)"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.income({
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
                        text: `💵 COIN-M Income History\n\nRecords: ${Array.isArray(data) ? data.length : 0}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get income history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
