// src/tools/binance-options/getOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsGetOrder(server: McpServer) {
    server.tool(
        "BinanceOptionsGetOrder",
        "Query an options order by order ID or client order ID.",
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
                
                const data = await optionsClient.getOrder(params);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Order details retrieved. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get order: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
