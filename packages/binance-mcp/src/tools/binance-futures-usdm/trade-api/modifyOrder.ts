/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/trade-api/modifyOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesModifyOrder(server: McpServer) {
    server.tool(
        "BinanceFuturesModifyOrder",
        "Modify an existing USD-M Futures order. Can modify price, quantity, or both.",
        {
            symbol: z.string().describe("Futures symbol (e.g., BTCUSDT)"),
            orderId: z.number().int().optional().describe("Order ID"),
            origClientOrderId: z.string().optional().describe("Original client order ID"),
            side: z.enum(["BUY", "SELL"]).describe("Order side"),
            quantity: z.string().optional().describe("New quantity"),
            price: z.string().optional().describe("New price"),
            priceMatch: z.enum(["OPPONENT", "OPPONENT_5", "OPPONENT_10", "OPPONENT_20", "QUEUE", "QUEUE_5", "QUEUE_10", "QUEUE_20"]).optional().describe("Price match mode"),
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
                
                const response = await futuresClient.restAPI.modifyOrder({
                    symbol: params.symbol,
                    side: params.side,
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.origClientOrderId && { origClientOrderId: params.origClientOrderId }),
                    ...(params.quantity && { quantity: params.quantity }),
                    ...(params.price && { price: params.price }),
                    ...(params.priceMatch && { priceMatch: params.priceMatch }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Order modified successfully!\n\nSymbol: ${data.symbol}\nOrder ID: ${data.orderId}\nSide: ${data.side}\nNew Price: ${data.price}\nNew Qty: ${data.origQty}\nStatus: ${data.status}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to modify order: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
