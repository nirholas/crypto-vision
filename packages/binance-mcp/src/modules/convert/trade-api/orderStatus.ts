// src/tools/binance-convert/trade-api/orderStatus.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { convertClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceConvertOrderStatus(server: McpServer) {
    server.tool(
        "BinanceConvertOrderStatus",
        "The API checks the status of a token conversion order using either the orderId or quoteId, and returns details like conversion status, assets involved, amounts, exchange rate, and order creation time.",
        {
            orderId: z.string().optional().describe("Order ID (either this or quoteId is required)"),
            quoteId: z.string().optional().describe("Quote ID (either this or orderId is required)")
        },
        async (params) => {
            try {
                const response = await convertClient.restAPI.orderStatus({
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.quoteId && { quoteId: params.quoteId })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully get the status of a token conversion . Response: ${JSON.stringify(
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
                            text: `Failed to check the status: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
