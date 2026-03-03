/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/trade-api/getAllOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesGetAllOrders(server: McpServer) {
    server.tool(
        "BinanceFuturesGetAllOrders",
        "Get all USD-M Futures orders (active, canceled, or filled) for a symbol.",
        {
            symbol: z.string().describe("Futures symbol (e.g., BTCUSDT)"),
            orderId: z.number().int().optional().describe("If set, get orders >= this orderId"),
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            limit: z.number().int().max(1000).optional().describe("Number of orders. Default 500, max 1000"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.allOrders({
                    symbol: params.symbol,
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                const orderCount = Array.isArray(data) ? data.length : 0;
                
                return {
                    content: [{
                        type: "text",
                        text: `All Orders for ${params.symbol}: ${orderCount} orders\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get all orders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
