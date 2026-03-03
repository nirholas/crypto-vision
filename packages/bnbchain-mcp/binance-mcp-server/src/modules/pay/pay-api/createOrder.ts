/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/pay/pay-api/createOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { payClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinancePayCreateOrder(server: McpServer) {
    server.tool(
        "BinancePayCreateOrder",
        "Create a Binance Pay order for receiving crypto payments. Generate payment links for e-commerce or P2P transactions. 💳",
        {
            merchantId: z.string().optional().describe("Merchant ID (for business accounts)"),
            orderId: z.string().describe("Unique order ID for your reference"),
            currency: z.string().describe("Payment currency (e.g., 'USDT', 'BTC')"),
            totalAmount: z.string().describe("Total payment amount"),
            description: z.string().optional().describe("Order description"),
            goodsName: z.string().optional().describe("Name of goods/service"),
            goodsDetail: z.string().optional().describe("Details of goods/service"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await payClient.restAPI.createOrder({
                    orderId: params.orderId,
                    currency: params.currency,
                    totalAmount: params.totalAmount,
                    ...(params.merchantId && { merchantId: params.merchantId }),
                    ...(params.description && { description: params.description }),
                    ...(params.goodsName && { goodsName: params.goodsName }),
                    ...(params.goodsDetail && { goodsDetail: params.goodsDetail }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `✅ Binance Pay Order Created!\n\nOrder ID: ${params.orderId}\nCurrency: ${params.currency}\nAmount: ${params.totalAmount}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to create pay order: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
