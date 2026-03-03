/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/trade-api/openOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryOpenOrder(server: McpServer) {
    server.tool(
        "BinanceDeliveryOpenOrder",
        "Query a single open COIN-M Futures order.",
        {
            symbol: z.string().describe("Contract symbol (e.g., BTCUSD_PERP)"),
            orderId: z.number().int().optional().describe("Order ID"),
            origClientOrderId: z.string().optional().describe("Original client order ID"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                if (!params.orderId && !params.origClientOrderId) {
                    return {
                        content: [{ type: "text", text: "Error: Either orderId or origClientOrderId must be provided" }],
                        isError: true
                    };
                }
                
                const response = await deliveryClient.restAPI.currentOpenOrder({
                    symbol: params.symbol,
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.origClientOrderId && { origClientOrderId: params.origClientOrderId }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `📋 Open Order\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get open order: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
