// src/tools/binance-wallet/asset-api/assetDividendRecord.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletAssetDividendRecord(server: McpServer) {
    server.tool(
        "BinanceWalletAssetDividendRecord",
        "Get asset dividend record.",
        {
            asset: z.string().optional().describe("Asset symbol"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            limit: z.number().optional().describe("Default 20, max 500"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ asset, startTime, endTime, limit, recvWindow }) => {
            try {
                const params: any = {};
                if (asset !== undefined) params.asset = asset;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (limit !== undefined) params.limit = limit;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const response = await walletClient.restAPI.assetDividendRecord(params);
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved asset dividend record. Total records: ${data.total || 0}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve asset dividend record: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}