// src/tools/binance-wallet/asset-api/queryUserUniversalTransferHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletQueryUserUniversalTransferHistory(server: McpServer) {
    server.tool(
        "BinanceWalletQueryUserUniversalTransferHistory",
        "Query universal transfer history.",
        {
            type: z.string().describe("Transfer type"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            current: z.number().optional().describe("Current page"),
            size: z.number().optional().describe("Page size"),
            fromSymbol: z.string().optional().describe("Symbol for spot/margin trade pair"),
            toSymbol: z.string().optional().describe("Symbol for spot/margin trade pair"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ type, startTime, endTime, current, size, fromSymbol, toSymbol, recvWindow }) => {
            try {
                const params: any = { type };
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (current !== undefined) params.current = current;
                if (size !== undefined) params.size = size;
                if (fromSymbol !== undefined) params.fromSymbol = fromSymbol;
                if (toSymbol !== undefined) params.toSymbol = toSymbol;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const response = await walletClient.restAPI.queryUserUniversalTransferHistory(params);
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved universal transfer history. Total: ${data.total || 0}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve universal transfer history: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}