/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/auto-invest/getSourceAssetList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerAutoInvestGetSourceAssetList(server: McpServer) {
    server.tool(
        "BinanceAutoInvestGetSourceAssetList",
        "Get the list of available source assets for auto-invest plans. These are the assets you can use to fund your recurring purchases.",
        {
            usageType: z.enum(["RECURRING", "ONE_TIME"]).optional().describe("Usage type filter"),
            targetAsset: z.string().optional().describe("Filter by target asset"),
            indexId: z.number().int().optional().describe("Index ID filter"),
            flexibleAllowedToUse: z.boolean().optional().describe("Filter by flexible savings availability"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.sourceAssetList({
                    ...(params.usageType && { usageType: params.usageType }),
                    ...(params.targetAsset && { targetAsset: params.targetAsset }),
                    ...(params.indexId && { indexId: params.indexId }),
                    ...(params.flexibleAllowedToUse !== undefined && { flexibleAllowedToUse: params.flexibleAllowedToUse }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Auto-Invest Source Assets\n\n`;
                
                if (data.sourceAssetList && Array.isArray(data.sourceAssetList)) {
                    result += `Total: ${data.sourceAssetList.length} assets\n\n`;
                    data.sourceAssetList.forEach((asset: any) => {
                        result += `**${asset.sourceAsset}**\n`;
                        result += `  Free Amount: ${asset.freeAmount}\n`;
                        result += `  Min Amount: ${asset.minAmount}\n`;
                        result += `  Max Amount: ${asset.maxAmount}\n\n`;
                    });
                } else if (Array.isArray(data)) {
                    data.forEach((asset: any) => {
                        result += `**${asset.sourceAsset || asset.asset}**\n`;
                        result += `  Available: ${asset.freeAmount || 'N/A'}\n\n`;
                    });
                } else {
                    result += `Source Assets: ${JSON.stringify(data)}`;
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
                        text: `❌ Failed to get auto-invest source assets: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
