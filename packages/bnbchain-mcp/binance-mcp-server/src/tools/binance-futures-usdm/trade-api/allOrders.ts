/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/trade-api/allOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../../config/binanceClient.js";

export function registerBinanceFuturesAllOrders(server: McpServer) {
    server.tool(
        "BinanceFuturesAllOrders",
        "Get all account orders (active, canceled, or filled) for a symbol. Returns orders from the last 7 days by default.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., BTCUSDT)"),
            orderId: z.number().optional().describe("If set, return orders >= this orderId"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            limit: z.number().optional().describe("Number of results (default 500, max 1000)")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.allOrders(
                    params.symbol,
                    {
                        orderId: params.orderId,
                        startTime: params.startTime,
                        endTime: params.endTime,
                        limit: params.limit
                    }
                );

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(response.data, null, 2)
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Error getting all orders: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
