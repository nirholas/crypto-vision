/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/simple-earn/flexible/getRateHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { simpleEarnClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerSimpleEarnFlexibleRateHistory(server: McpServer) {
    server.tool(
        "BinanceSimpleEarnFlexibleRateHistory",
        "Get historical APR rates for a flexible product. Useful for analyzing rate trends and making informed investment decisions.",
        {
            productId: z.string().describe("Product ID to get rate history for"),
            startTime: z.number().int().optional().describe("Start time in ms"),
            endTime: z.number().int().optional().describe("End time in ms"),
            current: z.number().int().min(1).default(1).optional().describe("Page number"),
            size: z.number().int().min(1).max(100).default(10).optional().describe("Page size"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await simpleEarnClient.restAPI.getFlexibleRateHistory({
                    productId: params.productId,
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.current && { current: params.current }),
                    ...(params.size && { size: params.size }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `📈 Flexible Product Rate History\n\nProduct ID: ${params.productId}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get rate history: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
