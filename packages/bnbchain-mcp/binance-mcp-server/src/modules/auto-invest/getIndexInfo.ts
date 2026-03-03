/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/auto-invest/getIndexInfo.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerAutoInvestGetIndexInfo(server: McpServer) {
    server.tool(
        "BinanceAutoInvestGetIndexInfo",
        "Get auto-invest index information. Index plans allow investing in a basket of cryptocurrencies.",
        {
            indexId: z.number().int().optional().describe("Specific index ID to query"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.indexInfo({
                    ...(params.indexId && { indexId: params.indexId }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Auto-Invest Index Information\n\n`;
                
                if (data.indexId) {
                    result += `**Index ID: ${data.indexId}**\n`;
                    result += `Status: ${data.status}\n\n`;
                    if (data.assetAllocation && Array.isArray(data.assetAllocation)) {
                        result += `**Asset Allocation**\n`;
                        data.assetAllocation.forEach((asset: any) => {
                            result += `- ${asset.targetAsset}: ${asset.allocation}%\n`;
                        });
                    }
                } else if (Array.isArray(data)) {
                    data.forEach((index: any) => {
                        result += `**Index ID: ${index.indexId}**\n`;
                        result += `Status: ${index.status}\n\n`;
                    });
                } else {
                    result += `Index Info: ${JSON.stringify(data)}`;
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
                        text: `❌ Failed to get auto-invest index info: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
