// src/tools/binance-sub-account/getSubAccountDepositHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { subAccountApiClient } from "../../config/binanceClient.js";

export function registerBinanceSubAccountGetDepositHistory(server: McpServer) {
    server.tool(
        "BinanceSubAccountGetDepositHistory",
        "Query sub-account deposit history.",
        {
            email: z.string().describe("Sub-account email"),
            coin: z.string().optional().describe("Coin to filter by"),
            status: z.number().optional().describe("0: pending, 6: credited but cannot withdraw, 1: success"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            limit: z.number().optional().describe("Default 500, max 500"),
            offset: z.number().optional().describe("Default 0"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ email, coin, status, startTime, endTime, limit, offset, recvWindow }) => {
            try {
                const params: any = { email };
                if (coin !== undefined) params.coin = coin;
                if (status !== undefined) params.status = status;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (limit !== undefined) params.limit = limit;
                if (offset !== undefined) params.offset = offset;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await subAccountApiClient.getSubAccountDepositHistory(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved deposit history for ${email}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get sub-account deposit history: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
