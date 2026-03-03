/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/trade-api/cancelBatchOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryCancelBatchOrders(server: McpServer) {
    server.tool(
        "BinanceDeliveryCancelBatchOrders",
        "Cancel multiple COIN-M Futures orders in batch (max 10).",
        {
            symbol: z.string().describe("Contract symbol (e.g., BTCUSD_PERP)"),
            orderIdList: z.string().optional().describe("JSON array of order IDs to cancel"),
            origClientOrderIdList: z.string().optional().describe("JSON array of client order IDs"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                if (!params.orderIdList && !params.origClientOrderIdList) {
                    return {
                        content: [{ type: "text", text: "Error: Either orderIdList or origClientOrderIdList must be provided" }],
                        isError: true
                    };
                }
                
                const response = await deliveryClient.restAPI.cancelMultipleOrders({
                    symbol: params.symbol,
                    ...(params.orderIdList && { orderIdList: JSON.parse(params.orderIdList) }),
                    ...(params.origClientOrderIdList && { origClientOrderIdList: JSON.parse(params.origClientOrderIdList) }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Batch orders cancelled!\n\n${JSON.stringify(data, null, 2)}`
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
