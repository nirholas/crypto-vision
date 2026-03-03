/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-algo/future-algo/historicalAlgoOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { algoClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFutureHistoricalAlgoOrder(server: McpServer) {
    server.tool(
        "BinanceFutureHistoricalAlgoOrder",
        "The Query Historical Algo Orders API retrieves a list of past algorithmic orders for USDⓈ-M Contracts in Binance Futures.",
        {
            symbol: z.string().optional().describe("Trading symbol (e.g., BTCUSDT)"),
            side: z.enum(["BUY", "SELL"]).optional().describe("Trading side (BUY or SELL)"),
            startTime: z.number().int().optional().describe("Start time in milliseconds (e.g., 1641522717552)"),
            endTime: z.number().int().optional().describe("End time in milliseconds (e.g., 1641522526562)"),
            page: z.number().int().min(1).default(1).optional().describe("Page number, default is 1"),
            pageSize: z
                .number()
                .int()
                .min(1)
                .max(100)
                .default(100)
                .optional()
                .describe("Number of results per page, MIN 1, MAX 100, default is 100"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await algoClient.restAPI.queryHistoricalAlgoOrdersFutureAlgo({
                    ...(params.symbol !== undefined && { symbol: params.symbol }),
                    ...(params.side !== undefined && { side: params.side }),
                    ...(params.startTime !== undefined && { startTime: params.startTime }),
                    ...(params.endTime !== undefined && { endTime: params.endTime }),
                    ...(params.page !== undefined && { page: params.page }),
                    ...(params.pageSize !== undefined && { pageSize: params.pageSize }),
                    ...(params.recvWindow !== undefined && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Historical Algo Orders retrieves successfully. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to Query Historical Algo Orders: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
