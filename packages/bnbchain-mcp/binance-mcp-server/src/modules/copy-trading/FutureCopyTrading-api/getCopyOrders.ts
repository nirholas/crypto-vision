/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/copy-trading/FutureCopyTrading-api/getCopyOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { copyTradingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCopyTradingGetCopyOrders(server: McpServer) {
    server.tool(
        "BinanceCopyTradingGetCopyOrders",
        "Get your copy trading order history. Shows all orders executed from copying lead traders.",
        {
            startTime: z.number().int().optional().describe("Start time in ms"),
            endTime: z.number().int().optional().describe("End time in ms"),
            pageNumber: z.number().int().min(1).default(1).optional().describe("Page number"),
            pageSize: z.number().int().min(1).max(100).default(10).optional().describe("Page size"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await copyTradingClient.restAPI.getCopyOrders({
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.pageNumber && { pageNumber: params.pageNumber }),
                    ...(params.pageSize && { pageSize: params.pageSize }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `📋 Copy Trading Orders\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get copy orders: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
