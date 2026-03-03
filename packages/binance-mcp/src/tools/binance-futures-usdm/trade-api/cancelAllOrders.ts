/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/trade-api/cancelAllOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesCancelAllOrders(server: McpServer) {
    server.tool(
        "BinanceFuturesCancelAllOrders",
        "Cancel all open USD-M Futures orders for a symbol. ⚠️ This will cancel ALL open orders for the specified symbol.",
        {
            symbol: z.string().describe("Futures symbol (e.g., BTCUSDT)"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.cancelAllOpenOrders({
                    symbol: params.symbol,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ All open orders cancelled for ${params.symbol}\n\n${JSON.stringify(data, null, 2)}`
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
