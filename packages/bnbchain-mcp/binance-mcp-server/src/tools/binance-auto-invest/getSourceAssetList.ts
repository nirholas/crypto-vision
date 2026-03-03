/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-auto-invest/getSourceAssetList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceAutoInvestGetSourceAssetList(server: McpServer) {
    server.tool(
        "BinanceAutoInvestGetSourceAssetList",
        "Get list of source assets available for auto-invest. These are the assets used to purchase target assets (e.g., USDT, BUSD).",
        {
            usageType: z.enum(["RECURRING", "ONE_TIME"]).optional().describe("Usage type for the source asset"),
            targetAsset: z.string().optional().describe("Filter by target asset"),
            indexId: z.number().int().optional().describe("Filter by index ID"),
            flexibleAllowedToUse: z.boolean().optional().describe("Include flexible savings balance"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.getSourceAssetList({
                    ...(params.usageType && { usageType: params.usageType }),
                    ...(params.targetAsset && { targetAsset: params.targetAsset }),
                    ...(params.indexId && { indexId: params.indexId }),
                    ...(params.flexibleAllowedToUse !== undefined && { flexibleAllowedToUse: params.flexibleAllowedToUse }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Source assets for auto-invest:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get source asset list: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
