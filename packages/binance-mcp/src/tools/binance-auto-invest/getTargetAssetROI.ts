// src/tools/binance-auto-invest/getTargetAssetROI.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { autoInvestClient } from "../../config/binanceClient.js";

export function registerBinanceAutoInvestGetTargetAssetROI(server: McpServer) {
    server.tool(
        "BinanceAutoInvestGetTargetAssetROI",
        "Get target asset ROI data for auto-invest.",
        {
            targetAsset: z.string().describe("Target asset (e.g., BTC)"),
            hisRoiType: z.enum(["FIVE_YEAR", "THREE_YEAR", "ONE_YEAR", "SIX_MONTH", "THREE_MONTH", "ONE_MONTH"]).describe("Historical ROI type")
        },
        async ({ targetAsset, hisRoiType }) => {
            try {
                const params: any = { targetAsset, hisRoiType };
                
                const response = await autoInvestClient.restAPI.getTargetAssetRoiData(params);
                const data = await response.data();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Target asset ROI data retrieved. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get target asset ROI: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
