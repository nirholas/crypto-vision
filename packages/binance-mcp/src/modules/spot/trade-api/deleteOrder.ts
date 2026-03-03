// src/tools/binance-spot/trade-api/deleteOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spotClient } from "../../../config/binanceClient.js";

export function registerBinanceDeleteOrder(server: McpServer) {
    server.tool(
        "BinanceDeleteOrder",
        "Cancel an active order on Binance for a specific trading pair.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            orderId: z.string().optional().describe("The order ID to cancel"),
            origClientOrderId: z.string().optional().describe("Original client order ID")
        },
        async ({ symbol, orderId, origClientOrderId }) => {
            try {
                const params: any = { symbol };
                
                if (orderId) params.orderId = orderId;
                if (origClientOrderId) params.origClientOrderId = origClientOrderId;
                
                const response = await spotClient.restAPI.deleteOrder(params);

                const data = await response.data();
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Order successfully canceled. Response: ${JSON.stringify(data)}`
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