/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-algo/spot-algo/subOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { algoClient } from "../../../config/binanceClient.js";

export function registerBinanceSpotSubOrders(server: McpServer) {
    server.tool(
        "BinanceSpotSubOrders",
        "The Query Sub Orders API retrieves details of sub-orders associated with a specific algorithmic (Algo) order for spot trading on Binance.",
        {
            algoId: z.number().int().describe("Algo order ID"),
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
                const response = await algoClient.restAPI.querySubOrdersSpotAlgo({
                    algoId: params.algoId,
                    ...(params.page !== undefined && { page: params.page }),
                    ...(params.pageSize !== undefined && { pageSize: params.pageSize }),
                    ...(params.recvWindow !== undefined && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Sub Orders retrieved successfully for id${params.algoId}. Response: ${JSON.stringify(
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
                            text: `Failed to Query Sub Orders: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
