/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/simple-earn/flexible/getFlexiblePosition.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { simpleEarnClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerSimpleEarnFlexiblePosition(server: McpServer) {
    server.tool(
        "BinanceSimpleEarnFlexiblePosition",
        "Get your current Simple Earn Flexible positions. Shows subscribed amount, cumulative rewards, and APR for each product.",
        {
            asset: z.string().optional().describe("Filter by asset symbol"),
            productId: z.string().optional().describe("Filter by product ID"),
            current: z.number().int().min(1).default(1).optional().describe("Page number"),
            size: z.number().int().min(1).max(100).default(10).optional().describe("Page size"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await simpleEarnClient.restAPI.getFlexibleProductPosition({
                    ...(params.asset && { asset: params.asset }),
                    ...(params.productId && { productId: params.productId }),
                    ...(params.current && { current: params.current }),
                    ...(params.size && { size: params.size }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `📊 Your Flexible Earn Positions\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get flexible positions: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
