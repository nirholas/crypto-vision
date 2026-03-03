/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-coinm/trade-api/allOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryAllOrders(server: McpServer) {
    server.tool(
        "BinanceDeliveryAllOrders",
        "Get all COIN-M Futures account orders (active, canceled, or filled).",
        {
            symbol: z.string().optional().describe("Contract symbol filter"),
            pair: z.string().optional().describe("Filter by underlying pair"),
            orderId: z.number().int().optional().describe("Return orders >= this orderId"),
            startTime: z.number().int().optional().describe("Start timestamp in milliseconds"),
            endTime: z.number().int().optional().describe("End timestamp in milliseconds"),
            limit: z.number().int().optional().describe("Number of results (default 500, max 1000)"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.allOrders({
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.pair && { pair: params.pair }),
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `📋 All Orders\n\nCount: ${Array.isArray(data) ? data.length : 0}\n\n${JSON.stringify(data, null, 2)}`
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
