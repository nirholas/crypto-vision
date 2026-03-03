/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/pay/pay-api/queryOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { payClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinancePayQueryOrder(server: McpServer) {
    server.tool(
        "BinancePayQueryOrder",
        "Query the status of a Binance Pay order. Check if payment has been received.",
        {
            merchantId: z.string().optional().describe("Merchant ID"),
            prepayId: z.string().optional().describe("Prepay ID from order creation"),
            merchantTradeNo: z.string().optional().describe("Your merchant trade number"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await payClient.restAPI.queryOrder({
                    ...(params.merchantId && { merchantId: params.merchantId }),
                    ...(params.prepayId && { prepayId: params.prepayId }),
                    ...(params.merchantTradeNo && { merchantTradeNo: params.merchantTradeNo }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `📋 Binance Pay Order Status\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to query pay order: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
