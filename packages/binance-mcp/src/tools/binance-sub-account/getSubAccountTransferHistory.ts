// src/tools/binance-sub-account/getSubAccountTransferHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { subAccountApiClient } from "../../config/binanceClient.js";

export function registerBinanceSubAccountGetTransferHistory(server: McpServer) {
    server.tool(
        "BinanceSubAccountGetTransferHistory",
        "Query sub-account transfer history.",
        {
            asset: z.string().optional().describe("Asset to filter by"),
            type: z.number().optional().describe("1: transfer in, 2: transfer out"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            limit: z.number().optional().describe("Default 500, max 500"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ asset, type, startTime, endTime, limit, recvWindow }) => {
            try {
                const params: any = {};
                if (asset !== undefined) params.asset = asset;
                if (type !== undefined) params.type = type;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (limit !== undefined) params.limit = limit;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await subAccountApiClient.getSubAccountTransferHistory(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved sub-account transfer history. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get sub-account transfer history: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
