/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/trade-api/cancelAllOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryCancelAllOrders(server: McpServer) {
    server.tool(
        "BinanceDeliveryCancelAllOrders",
        "Cancel all open COIN-M Futures orders for a symbol. ⚠️ Use with caution!",
        {
            symbol: z.string().describe("Contract symbol (e.g., BTCUSD_PERP)"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.cancelAllOpenOrders({
                    symbol: params.symbol,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ All orders cancelled for ${params.symbol}!\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to cancel all orders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
