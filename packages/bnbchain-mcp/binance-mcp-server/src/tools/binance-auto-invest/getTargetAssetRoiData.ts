/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-auto-invest/getTargetAssetRoiData.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceAutoInvestGetTargetAssetRoiData(server: McpServer) {
    server.tool(
        "BinanceAutoInvestGetTargetAssetRoiData",
        "Get ROI (Return on Investment) data for auto-invest target assets. Shows historical performance.",
        {
            targetAsset: z.string().describe("Target asset (e.g., 'BTC', 'ETH')"),
            hisRoiType: z.enum(["FIVE_YEAR", "THREE_YEAR", "ONE_YEAR", "SIX_MONTH", "THREE_MONTH", "SEVEN_DAY"]).describe("Historical ROI period"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.getTargetAssetRoiData({
                    targetAsset: params.targetAsset,
                    hisRoiType: params.hisRoiType,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `ROI data for ${params.targetAsset} (${params.hisRoiType}):\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get ROI data: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
