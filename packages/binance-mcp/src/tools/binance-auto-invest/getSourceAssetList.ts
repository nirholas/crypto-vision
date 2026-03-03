// src/tools/binance-auto-invest/getSourceAssetList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { autoInvestClient } from "../../config/binanceClient.js";

export function registerBinanceAutoInvestGetSourceAssetList(server: McpServer) {
    server.tool(
        "BinanceAutoInvestGetSourceAssetList",
        "Get source asset list for auto-invest.",
        {
            usageType: z.string().optional().describe("Usage type"),
            targetAsset: z.string().optional().describe("Target asset (e.g., BTC)"),
            indexId: z.number().optional().describe("Index ID"),
            flexibleAllowedToUse: z.boolean().optional().describe("Whether flexible products are allowed to use")
        },
        async ({ usageType, targetAsset, indexId, flexibleAllowedToUse }) => {
            try {
                const params: any = {};
                if (usageType) params.usageType = usageType;
                if (targetAsset) params.targetAsset = targetAsset;
                if (indexId !== undefined) params.indexId = indexId;
                if (flexibleAllowedToUse !== undefined) params.flexibleAllowedToUse = flexibleAllowedToUse;
                
                const response = await autoInvestClient.restAPI.querySourceAssetList(params);
                const data = await response.data();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Source asset list retrieved. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get source asset list: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
