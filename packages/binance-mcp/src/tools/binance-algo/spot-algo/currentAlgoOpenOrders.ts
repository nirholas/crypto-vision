// src/tools/binance-algo/spot-algo/currentAlgoOpenOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { algoClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceSpotCurrentAlgoOpenOrders(server: McpServer) {
    server.tool(
        "BinanceSpotCurrentAlgoOpenOrders",
        "This API retrieves all open SPOT TWAP (Time-Weighted Average Price) orders on Binance.",
        {
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await algoClient.restAPI.queryCurrentAlgoOpenOrdersSpotAlgo({
                    ...(params.recvWindow !== undefined && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieve all open SPOT TWAP (Time-Weighted Average Price) orders. Response: ${JSON.stringify(
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
                            text: `Failed to retrieves all open SPOT TWAP: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
