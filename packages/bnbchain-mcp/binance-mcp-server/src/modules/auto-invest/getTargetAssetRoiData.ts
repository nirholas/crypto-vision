/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/auto-invest/getTargetAssetRoiData.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerAutoInvestGetTargetAssetRoiData(server: McpServer) {
    server.tool(
        "BinanceAutoInvestGetTargetAssetRoiData",
        "Get ROI (Return on Investment) data for auto-invest target assets. Shows historical performance data.",
        {
            targetAsset: z.string().describe("Target asset (e.g., 'BTC')"),
            hisRoiType: z.enum(["FIVE_YEAR", "THREE_YEAR", "ONE_YEAR", "SIX_MONTH", "THREE_MONTH", "SEVEN_DAY"])
                .describe("Historical ROI time period"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.targetAssetRoiList({
                    targetAsset: params.targetAsset,
                    hisRoiType: params.hisRoiType,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Auto-Invest ROI Data - ${params.targetAsset}\n\n`;
                result += `Period: ${params.hisRoiType}\n\n`;
                
                if (Array.isArray(data) && data.length > 0) {
                    data.forEach((item: any) => {
                        result += `Date: ${item.date}\n`;
                        result += `  Simulated ROI: ${item.simulatedRoi}%\n\n`;
                    });
                } else if (data.data && Array.isArray(data.data)) {
                    data.data.forEach((item: any) => {
                        result += `Date: ${item.date}\n`;
                        result += `  Simulated ROI: ${item.simulatedRoi}%\n\n`;
                    });
                } else {
                    result += `ROI Data: ${JSON.stringify(data)}`;
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
                        text: `❌ Failed to get auto-invest ROI data: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
