/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-wallet/asset-api/getCloudMiningPaymentAndRefundHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletGetCloudMiningPaymentAndRefundHistory(server: McpServer) {
    server.tool(
        "BinanceWalletGetCloudMiningPaymentAndRefundHistory",
        "Get cloud mining payment and refund history.",
        {
            startTime: z.number().describe("Start time in milliseconds"),
            endTime: z.number().describe("End time in milliseconds"),
            page: z.number().optional().describe("Page number"),
            pageSize: z.number().optional().describe("Page size"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ startTime, endTime, page, pageSize, recvWindow }) => {
            try {
                const params: any = {
                    startTime,
                    endTime
                };
                if (page !== undefined) params.page = page;
                if (pageSize !== undefined) params.pageSize = pageSize;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const response = await walletClient.restAPI.getCloudMiningPaymentAndRefundHistory(params);
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved cloud mining payment and refund history. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve cloud mining history: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}