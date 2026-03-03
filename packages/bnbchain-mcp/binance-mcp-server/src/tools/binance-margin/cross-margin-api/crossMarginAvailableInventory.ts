/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/cross-margin-api/crossMarginAvailableInventory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginAvailableInventory(server: McpServer) {
    server.tool(
        "BinanceCrossMarginAvailableInventory",
        "Query available inventory for margin borrowing.",
        {
            type: z.enum(["MARGIN", "ISOLATED"]).describe("Type of margin account"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await marginClient.restAPI.queryMarginAvailableInventory({
                    type: params.type,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Available Inventory: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query available inventory: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
