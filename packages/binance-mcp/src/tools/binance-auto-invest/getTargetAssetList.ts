// src/tools/binance-auto-invest/getTargetAssetList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { autoInvestClient } from "../../config/binanceClient.js";

export function registerBinanceAutoInvestGetTargetAssetList(server: McpServer) {
    server.tool(
        "BinanceAutoInvestGetTargetAssetList",
        "Get target asset list for auto-invest.",
        {
            targetAsset: z.string().optional().describe("Target asset (e.g., BTC)"),
            size: z.number().optional().describe("Page size"),
            current: z.number().optional().describe("Current page")
        },
        async ({ targetAsset, size, current }) => {
            try {
                const params: any = {};
                if (targetAsset) params.targetAsset = targetAsset;
                if (size !== undefined) params.size = size;
                if (current !== undefined) params.current = current;
                
                const response = await autoInvestClient.restAPI.getTargetAssetList(params);
                const data = await response.data();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Target asset list retrieved. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get target asset list: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
