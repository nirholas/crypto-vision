// src/tools/binance-sub-account/getUniversalTransferHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { subAccountApiClient } from "../../config/binanceClient.js";

export function registerBinanceSubAccountGetUniversalTransferHistory(server: McpServer) {
    server.tool(
        "BinanceSubAccountGetUniversalTransferHistory",
        "Query universal transfer history for sub-accounts.",
        {
            fromEmail: z.string().optional().describe("Sender email"),
            toEmail: z.string().optional().describe("Recipient email"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            page: z.number().optional().describe("Page number, default 1"),
            limit: z.number().optional().describe("Results per page, default 500, max 500"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ fromEmail, toEmail, startTime, endTime, page, limit, recvWindow }) => {
            try {
                const params: any = {};
                if (fromEmail !== undefined) params.fromEmail = fromEmail;
                if (toEmail !== undefined) params.toEmail = toEmail;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (page !== undefined) params.page = page;
                if (limit !== undefined) params.limit = limit;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await subAccountApiClient.getSubAccountUniversalTransferHistory(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved universal transfer history. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get universal transfer history: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
