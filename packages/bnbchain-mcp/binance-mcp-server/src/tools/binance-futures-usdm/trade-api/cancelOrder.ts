/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/trade-api/cancelOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesCancelOrder(server: McpServer) {
    server.tool(
        "BinanceFuturesCancelOrder",
        "Cancel a specific USD-M Futures order by orderId or origClientOrderId.",
        {
            symbol: z.string().describe("Futures symbol (e.g., BTCUSDT)"),
            orderId: z.number().int().optional().describe("Order ID"),
            origClientOrderId: z.string().optional().describe("Original client order ID"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                if (!params.orderId && !params.origClientOrderId) {
                    return {
                        content: [{ type: "text", text: "Either orderId or origClientOrderId must be provided" }],
                        isError: true
                    };
                }
                
                const response = await futuresClient.restAPI.cancelOrder({
                    symbol: params.symbol,
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.origClientOrderId && { origClientOrderId: params.origClientOrderId }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Order cancelled successfully!\n\nSymbol: ${data.symbol}\nOrder ID: ${data.orderId}\nClient Order ID: ${data.clientOrderId}\nStatus: ${data.status}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to cancel order: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
