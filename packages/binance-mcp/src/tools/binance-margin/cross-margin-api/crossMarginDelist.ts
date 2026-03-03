// src/tools/binance-margin/cross-margin-api/crossMarginDelist.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginDelist(server: McpServer) {
    server.tool(
        "BinanceCrossMarginDelist",
        "Get delist schedule for cross margin trading pairs. Shows upcoming delistings.",
        {
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.getDelistSchedule({
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Cross Margin Delist Schedule: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get delist schedule: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
