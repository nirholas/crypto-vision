/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/options/trade-api/cancelOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerOptionsCancelOrder(server: McpServer) {
    server.tool(
        "BinanceOptionsCancelOrder",
        "Cancel an active options order by order ID or client order ID.",
        {
            symbol: z.string().describe("Option symbol (e.g., 'BTC-240126-40000-C')"),
            orderId: z.number().int().optional().describe("Order ID to cancel"),
            clientOrderId: z.string().optional().describe("Client order ID to cancel"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                if (!params.orderId && !params.clientOrderId) {
                    return {
                        content: [{
                            type: "text",
                            text: `❌ Either orderId or clientOrderId must be provided`
                        }],
                        isError: true
                    };
                }
                
                const response = await optionsClient.restAPI.cancelOrder({
                    symbol: params.symbol,
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.clientOrderId && { clientOrderId: params.clientOrderId }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Options order cancelled!\n\nOrder ID: ${data.orderId}\nSymbol: ${data.symbol}\nSide: ${data.side}\nQuantity: ${data.quantity}\nPrice: ${data.price}\nStatus: ${data.status}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to cancel options order: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
