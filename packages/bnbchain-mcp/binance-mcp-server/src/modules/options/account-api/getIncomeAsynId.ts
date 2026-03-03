/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/options/account-api/getIncomeAsynId.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerOptionsGetIncomeAsynId(server: McpServer) {
    server.tool(
        "BinanceOptionsGetIncomeAsynId",
        "Get the download URL for options income history using a download ID from BinanceOptionsGetIncomeAsyn.",
        {
            downloadId: z.string().describe("Download ID from BinanceOptionsGetIncomeAsyn"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await optionsClient.restAPI.incomeAsynId({
                    downloadId: params.downloadId,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Options Income Download Status\n\n`;
                result += `Download ID: ${params.downloadId}\n`;
                result += `Status: ${data.status}\n`;
                
                if (data.url) {
                    result += `\n**Download URL**: ${data.url}\n`;
                    result += `\nNote: URL is valid for a limited time.`;
                } else if (data.status === 'processing') {
                    result += `\nThe download is still being processed. Please try again in a few moments.`;
                }
                
                return {
                    content: [{
                        type: "text",
                        text: result
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get options income download: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
