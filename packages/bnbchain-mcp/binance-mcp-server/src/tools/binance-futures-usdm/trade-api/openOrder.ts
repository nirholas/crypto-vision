/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/trade-api/openOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../../config/binanceClient.js";

export function registerBinanceFuturesOpenOrder(server: McpServer) {
    server.tool(
        "BinanceFuturesOpenOrder",
        "Query a single open order. Either orderId or origClientOrderId must be provided.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., BTCUSDT)"),
            orderId: z.number().optional().describe("Order ID"),
            origClientOrderId: z.string().optional().describe("Original client order ID")
        },
        async (params) => {
            try {
                if (!params.orderId && !params.origClientOrderId) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: "Error: Either orderId or origClientOrderId must be provided"
                            }
                        ],
                        isError: true
                    };
                }

                const response = await futuresClient.restAPI.currentOpenOrder(
                    params.symbol,
                    {
                        orderId: params.orderId,
                        origClientOrderId: params.origClientOrderId
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
                            text: `Error getting open order: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
