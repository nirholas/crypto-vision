/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/auto-invest/getTargetAssetList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerAutoInvestGetTargetAssetList(server: McpServer) {
    server.tool(
        "BinanceAutoInvestGetTargetAssetList",
        "Get the list of available target assets for auto-invest plans. Shows assets available for dollar-cost averaging.",
        {
            targetAsset: z.string().optional().describe("Filter by specific target asset (e.g., 'BTC')"),
            size: z.number().int().min(1).max(100).optional().describe("Number of results (default 10, max 100)"),
            current: z.number().int().min(1).optional().describe("Page number (default 1)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.targetAssetList({
                    ...(params.targetAsset && { targetAsset: params.targetAsset }),
                    ...(params.size && { size: params.size }),
                    ...(params.current && { current: params.current }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Auto-Invest Target Assets\n\n`;
                
                if (data.data && Array.isArray(data.data) && data.data.length > 0) {
                    result += `Total assets: ${data.total || data.data.length}\n\n`;
                    data.data.forEach((asset: any) => {
                        result += `**${asset.targetAsset}**\n`;
                        result += `  ROI: ${asset.roiAndDimensionTypeList ? 'Available' : 'N/A'}\n`;
                        result += `  Available: ${asset.available !== false}\n\n`;
                    });
                } else if (Array.isArray(data) && data.length > 0) {
                    data.forEach((asset: any) => {
                        result += `**${asset.targetAsset || asset.asset}**\n`;
                        result += `  Available: ${asset.available !== false}\n\n`;
                    });
                } else {
                    result += `No target assets found`;
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
                        text: `❌ Failed to get auto-invest target assets: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
