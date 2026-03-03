/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-simple-earn/account-api/getFlexibleProductPosition.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { simpleEarnClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetFlexibleProductPosition(server: McpServer) {
    server.tool(
        "BinanceGetFlexibleProductPosition",
        "Fetch your current holdings in Simple Earn Flexible Products, including total amount, reward rates, and redeem status.",
        {
            asset: z.string().optional().describe("Asset symbol (optional)"),
            productId: z.string().optional().describe("Product ID (optional)"),
            current: z
                .number()
                .int()
                .min(1)
                .default(1)
                .optional()
                .describe("Currently querying the page. Starts from 1. Default: 1"),
            size: z.number().int().min(1).max(100).default(10).optional().describe("Page size. Default: 10, Max: 100"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
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
                    content: [
                        {
                            type: "text",
                            text: `Successfully fetched your current holdings in Simple Earn Flexible Products. Response: ${JSON.stringify(
                                data
                            )}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to fetch your current holdings in Simple Earn Flexible Products: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
