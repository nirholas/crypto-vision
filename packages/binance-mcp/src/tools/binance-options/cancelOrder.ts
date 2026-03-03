// src/tools/binance-options/cancelOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsCancelOrder(server: McpServer) {
    server.tool(
        "BinanceOptionsCancelOrder",
        "Cancel an existing options order.",
        {
            symbol: z.string().describe("Option trading symbol (e.g., BTC-240126-42000-C)"),
            orderId: z.number().optional().describe("Order ID"),
            clientOrderId: z.string().optional().describe("Client order ID")
        },
        async ({ symbol, orderId, clientOrderId }) => {
            try {
                const params: any = { symbol };
                if (orderId !== undefined) params.orderId = orderId;
                if (clientOrderId) params.clientOrderId = clientOrderId;
                
                const data = await optionsClient.cancelOrder(params);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Order cancelled successfully. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to cancel order: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
