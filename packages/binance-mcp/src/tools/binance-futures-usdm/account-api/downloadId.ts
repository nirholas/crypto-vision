/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/account-api/downloadId.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesDownloadIdForFuturesTransactionHistory(server: McpServer) {
    server.tool(
        "BinanceFuturesDownloadId",
        "Get download ID for USD-M Futures transaction history.",
        {
            startTime: z.number().int().describe("Start timestamp in ms"),
            endTime: z.number().int().describe("End timestamp in ms"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.downloadIdForFuturesTransactionHistory({
                    startTime: params.startTime,
                    endTime: params.endTime,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Download ID: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get download ID: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
