// src/tools/binance-options/cancelBatchOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsCancelBatchOrders(server: McpServer) {
    server.tool(
        "BinanceOptionsCancelBatchOrders",
        "Cancel multiple options orders in batch.",
        {
            symbol: z.string().describe("Option trading symbol (e.g., BTC-240126-42000-C)"),
            orderIds: z.string().optional().describe("Comma-separated list of order IDs to cancel"),
            clientOrderIds: z.string().optional().describe("Comma-separated list of client order IDs to cancel")
        },
        async ({ symbol, orderIds, clientOrderIds }) => {
            try {
                const params: any = { symbol };
                if (orderIds) params.orderIds = orderIds;
                if (clientOrderIds) params.clientOrderIds = clientOrderIds;
                
                const data = await optionsClient.cancelBatchOrders(params);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Batch orders cancelled successfully. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to cancel batch orders: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
