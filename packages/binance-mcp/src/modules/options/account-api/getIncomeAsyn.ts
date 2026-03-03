/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/options/account-api/getIncomeAsyn.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerOptionsGetIncomeAsyn(server: McpServer) {
    server.tool(
        "BinanceOptionsGetIncomeAsyn",
        "Request to generate an async download ID for options income history. Use with BinanceOptionsGetIncomeAsynId to retrieve results.",
        {
            startTime: z.number().int().describe("Start time in milliseconds"),
            endTime: z.number().int().describe("End time in milliseconds"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await optionsClient.restAPI.incomeAsyn({
                    startTime: params.startTime,
                    endTime: params.endTime,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Options Income Download Request Submitted\n\nDownload ID: ${data.downloadId || data.id}\n\nUse BinanceOptionsGetIncomeAsynId with this ID to retrieve the download URL.`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to request options income download: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
