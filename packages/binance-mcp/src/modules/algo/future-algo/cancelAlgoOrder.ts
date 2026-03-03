// src/tools/binance-algo/future-algo/cancelAlgoOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { algoClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFutureCancelAlgoOrder(server: McpServer) {
    server.tool(
        "BinanceFutureCancelAlgoOrder",
        "The Cancel Algo Order API allows users to cancel an active algorithmic order on USDⓈ-M Contracts in Binance Futures.",
        {
            algoId: z.number().int().describe("Algo order ID (e.g., 14511)"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await algoClient.restAPI.cancelAlgoOrderFutureAlgo({
                    algoId: params.algoId,
                    ...(params.recvWindow !== undefined && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Algo order ${params.algoId} canceled successfully. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to cancel Algo Order: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
