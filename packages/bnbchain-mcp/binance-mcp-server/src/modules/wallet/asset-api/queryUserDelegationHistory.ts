/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-wallet/asset-api/queryUserDelegationHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletQueryUserDelegationHistory(server: McpServer) {
    server.tool(
        "BinanceWalletQueryUserDelegationHistory",
        "Query user delegation history.",
        {
            email: z.string().describe("Email address"),
            startTime: z.number().describe("Start time in milliseconds"),
            endTime: z.number().describe("End time in milliseconds"),
            page: z.number().optional().describe("Page number"),
            limit: z.number().optional().describe("Results per page"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ email, startTime, endTime, page, limit, recvWindow }) => {
            try {
                const params: any = {
                    email,
                    startTime,
                    endTime
                };
                if (page !== undefined) params.page = page;
                if (limit !== undefined) params.limit = limit;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const response = await walletClient.restAPI.queryUserDelegationHistory(params);
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved user delegation history. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve user delegation history: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}