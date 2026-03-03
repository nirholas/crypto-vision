// src/tools/binance-futures-usdm/cancelOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMCancelOrder(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMCancelOrder",
        "Cancel an existing order for USD-M Futures.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            orderId: z.number().optional().describe("Order ID"),
            origClientOrderId: z.string().optional().describe("Original client order ID")
        },
        async ({ symbol, orderId, origClientOrderId }) => {
            try {
                const params: any = { symbol };
                if (orderId !== undefined) params.orderId = orderId;
                if (origClientOrderId) params.origClientOrderId = origClientOrderId;

                const data = await futuresClient.cancelOrder(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `USD-M Futures order cancelled successfully. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to cancel USD-M Futures order: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
