// src/tools/binance-convert/trade-api/queryLimitOpenOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { convertClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceConvertQueryLimitOpenOrders(server: McpServer) {
    server.tool(
        "BinanceConvertQueryLimitOpenOrders",
        "Retrieves all your open limit orders for token conversions, showing details like assets, amounts, exchange rate, order status, and expiration time.",
        {
            recvWindow: z
                .number()
                .int()
                .max(60000, "recvWindow must not be greater than 60000")
                .optional()
                .describe("This value must not exceed 60000")
        },
        async (params) => {
            try {
                const response = await convertClient.restAPI.queryLimitOpenOrders({
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved all the open limit orders for token conversions. Response: ${JSON.stringify(
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
                            text: `Failed to retrieve all your open limit orders : ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
