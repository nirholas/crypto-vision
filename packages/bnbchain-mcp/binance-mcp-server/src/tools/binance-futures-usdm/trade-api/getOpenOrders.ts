/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/trade-api/getOpenOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesGetOpenOrders(server: McpServer) {
    server.tool(
        "BinanceFuturesGetOpenOrders",
        "Get all open USD-M Futures orders for a symbol or all symbols.",
        {
            symbol: z.string().optional().describe("Futures symbol (e.g., BTCUSDT). If not provided, returns all open orders"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.currentAllOpenOrders({
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                const orderCount = Array.isArray(data) ? data.length : 0;
                const orderSummary = Array.isArray(data) && data.length > 0 
                    ? data.map((order: any) => 
                        `${order.symbol} ${order.side} ${order.type} ${order.origQty}@${order.price} (ID: ${order.orderId})`
                    ).join('\n')
                    : 'No open orders';
                
                return {
                    content: [{
                        type: "text",
                        text: `Open Orders${params.symbol ? ` for ${params.symbol}` : ''}: ${orderCount}\n\n${orderSummary}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get open orders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
