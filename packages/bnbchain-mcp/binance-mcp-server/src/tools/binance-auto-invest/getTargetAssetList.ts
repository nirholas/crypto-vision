/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-auto-invest/getTargetAssetList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceAutoInvestGetTargetAssetList(server: McpServer) {
    server.tool(
        "BinanceAutoInvestGetTargetAssetList",
        "Get list of target assets available for auto-invest plans. These are the cryptocurrencies you can purchase.",
        {
            targetAsset: z.string().optional().describe("Filter by specific target asset (e.g., 'BTC', 'ETH')"),
            size: z.number().int().max(100).optional().describe("Number of results per page. Default 8, max 100"),
            current: z.number().int().optional().describe("Current page number. Default 1"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.getTargetAssetList({
                    ...(params.targetAsset && { targetAsset: params.targetAsset }),
                    ...(params.size && { size: params.size }),
                    ...(params.current && { current: params.current }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Target assets for auto-invest:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get target asset list: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
