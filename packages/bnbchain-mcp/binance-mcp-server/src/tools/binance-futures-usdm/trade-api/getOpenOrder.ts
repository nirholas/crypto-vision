/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/trade-api/getOpenOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesGetOpenOrder(server: McpServer) {
    server.tool(
        "BinanceFuturesGetOpenOrder",
        "Query a specific open USD-M Futures order by orderId or origClientOrderId.",
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
                
                const response = await futuresClient.restAPI.queryCurrentOpenOrder({
                    symbol: params.symbol,
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.origClientOrderId && { origClientOrderId: params.origClientOrderId }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `Open Order Details:\n\nSymbol: ${data.symbol}\nOrder ID: ${data.orderId}\nClient Order ID: ${data.clientOrderId}\nSide: ${data.side}\nType: ${data.type}\nStatus: ${data.status}\nPrice: ${data.price}\nQty: ${data.origQty}\nExecuted Qty: ${data.executedQty}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query open order: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
