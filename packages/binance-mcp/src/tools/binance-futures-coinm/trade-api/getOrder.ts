/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/trade-api/getOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryGetOrder(server: McpServer) {
    server.tool(
        "BinanceDeliveryGetOrder",
        "Query a specific COIN-M Futures order's status.",
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
                
                const response = await deliveryClient.restAPI.queryOrder({
                    symbol: params.symbol,
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.origClientOrderId && { origClientOrderId: params.origClientOrderId }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `📋 Order Details\n\nSymbol: ${data.symbol}\nOrder ID: ${data.orderId}\nStatus: ${data.status}\nSide: ${data.side}\nType: ${data.type}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get order: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
