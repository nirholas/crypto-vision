/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-wallet/travel-rule-api/depositHistoryTravelRule.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletDepositHistoryTravelRule(server: McpServer) {
    server.tool(
        "BinanceWalletDepositHistoryTravelRule",
        "Get deposit history for travel rule.",
        {
            coin: z.string().optional().describe("Coin symbol"),
            status: z.number().optional().describe("Deposit status"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            offset: z.number().optional().describe("Default 0"),
            limit: z.number().optional().describe("Default 1000, max 1000"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ coin, status, startTime, endTime, offset, limit, recvWindow }) => {
            try {
                const params: any = {};
                if (coin !== undefined) params.coin = coin;
                if (status !== undefined) params.status = status;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (offset !== undefined) params.offset = offset;
                if (limit !== undefined) params.limit = limit;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const response = await walletClient.restAPI.depositHistoryTravelRule(params);
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved deposit history for travel rule. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve deposit history: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}