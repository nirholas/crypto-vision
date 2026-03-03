/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/simple-earn/flexible/getFlexibleProductList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { simpleEarnClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerSimpleEarnFlexibleProductList(server: McpServer) {
    server.tool(
        "BinanceSimpleEarnFlexibleProductList",
        "Get available Simple Earn Flexible products. Returns product details including APR, minimum purchase amount, and availability status.",
        {
            asset: z.string().optional().describe("Filter by asset symbol (e.g., 'BTC', 'ETH')"),
            current: z.number().int().min(1).default(1).optional().describe("Page number, starting from 1"),
            size: z.number().int().min(1).max(100).default(10).optional().describe("Page size (1-100)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await simpleEarnClient.restAPI.getSimpleEarnFlexibleProductList({
                    ...(params.asset && { asset: params.asset }),
                    ...(params.current && { current: params.current }),
                    ...(params.size && { size: params.size }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `📋 Simple Earn Flexible Products\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get flexible product list: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
