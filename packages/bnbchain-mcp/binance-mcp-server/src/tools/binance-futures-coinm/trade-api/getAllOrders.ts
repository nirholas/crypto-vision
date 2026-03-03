/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-coinm/trade-api/getAllOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryGetAllOrders(server: McpServer) {
    server.tool(
        "BinanceDeliveryGetAllOrders",
        "Get all COIN-M Futures orders (active, canceled, filled) for a symbol.",
        {
            symbol: z.string().describe("Contract symbol (e.g., BTCUSD_PERP)"),
            pair: z.string().optional().describe("Contract pair (e.g., BTCUSD)"),
            orderId: z.number().int().optional().describe("Order ID to start from"),
            startTime: z.number().int().optional().describe("Start timestamp in ms"),
            endTime: z.number().int().optional().describe("End timestamp in ms"),
            limit: z.number().int().optional().describe("Number of orders (default 500, max 1000)"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.allOrders({
                    symbol: params.symbol,
                    ...(params.pair && { pair: params.pair }),
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();
                const orders = Array.isArray(data) ? data : [data];

                const summary = orders.slice(0, 10).map((o: any) =>
                    `${o.symbol}: ${o.side} ${o.type} ${o.origQty} @ ${o.price || 'MARKET'} - ${o.status}`
                ).join('\n');

                return {
                    content: [{
                        type: "text",
                        text: `📋 All Orders for ${params.symbol} (${orders.length} total)\n\n${summary}\n\nFull data: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get all orders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
