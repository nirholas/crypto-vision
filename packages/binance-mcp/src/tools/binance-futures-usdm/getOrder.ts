// src/tools/binance-futures-usdm/getOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMGetOrder(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMGetOrder",
        "Query an existing order for USD-M Futures.",
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

                const data = await futuresClient.getOrder(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved USD-M Futures order. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve USD-M Futures order: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
