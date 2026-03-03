/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-spot/trade-api/getOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spotClient } from "../../../config/binanceClient.js";

export function registerBinanceGetOrder(server: McpServer) {
    server.tool(
        "BinanceGetOrder",
        "Check an order's status on Binance for a specific trading pair.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            orderId: z.string().optional().describe("The order ID to query"),
            origClientOrderId: z.string().optional().describe("Original client order ID")
        },
        async ({ symbol, orderId, origClientOrderId }) => {
            try {
                const params: any = { symbol };
                
                if (orderId) params.orderId = orderId;
                if (origClientOrderId) params.origClientOrderId = origClientOrderId;
                
                const response = await spotClient.restAPI.getOrder(params);

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Order information retrieved successfully. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve order information: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}