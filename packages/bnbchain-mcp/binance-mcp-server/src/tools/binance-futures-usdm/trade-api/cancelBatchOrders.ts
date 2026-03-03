/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/trade-api/cancelBatchOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesCancelBatchOrders(server: McpServer) {
    server.tool(
        "BinanceFuturesCancelBatchOrders",
        "Cancel multiple USD-M Futures orders in batch (max 10 orders).",
        {
            symbol: z.string().describe("Futures symbol (e.g., BTCUSDT)"),
            orderIdList: z.array(z.number().int()).max(10).optional().describe("List of order IDs to cancel (max 10)"),
            origClientOrderIdList: z.array(z.string()).max(10).optional().describe("List of client order IDs to cancel (max 10)"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                if (!params.orderIdList && !params.origClientOrderIdList) {
                    return {
                        content: [{ type: "text", text: "Either orderIdList or origClientOrderIdList must be provided" }],
                        isError: true
                    };
                }
                
                const response = await futuresClient.restAPI.cancelMultipleOrders({
                    symbol: params.symbol,
                    ...(params.orderIdList && { orderIdList: JSON.stringify(params.orderIdList) }),
                    ...(params.origClientOrderIdList && { origClientOrderIdList: JSON.stringify(params.origClientOrderIdList) }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                const results = Array.isArray(data) ? data.map((order: any, index: number) => {
                    if (order.orderId && order.status === 'CANCELED') {
                        return `Order ${index + 1}: ✅ Cancelled - ID: ${order.orderId}`;
                    } else if (order.code) {
                        return `Order ${index + 1}: ❌ Failed - ${order.msg || 'Unknown error'}`;
                    } else {
                        return `Order ${index + 1}: ${order.status} - ID: ${order.orderId}`;
                    }
                }).join('\n') : 'Unexpected response format';
                
                return {
                    content: [{
                        type: "text",
                        text: `Batch Cancel Results:\n${results}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to cancel batch orders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
