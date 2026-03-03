/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-wallet/account-api/dailyAccountSnapshot.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletDailyAccountSnapshot(server: McpServer) {
    server.tool(
        "BinanceWalletDailyAccountSnapshot",
        "Get daily account snapshot.",
        {
            type: z.string().describe("The account type (e.g., SPOT, MARGIN, FUTURES)"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            limit: z.number().optional().describe("Default 7, max 30"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ type, startTime, endTime, limit, recvWindow }) => {
            try {
                const params: any = { type };
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (limit !== undefined) params.limit = limit;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const response = await walletClient.restAPI.dailyAccountSnapshot(params);
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved daily account snapshot for ${type}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve daily account snapshot: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}