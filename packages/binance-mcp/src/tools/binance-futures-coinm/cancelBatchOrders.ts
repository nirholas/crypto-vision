// src/tools/binance-futures-coinm/cancelBatchOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deliveryClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesCOINMCancelBatchOrders(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMCancelBatchOrders",
        "Cancel multiple orders for COIN-M Futures.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSD_PERP)"),
            orderIdList: z.string().optional().describe("Comma-separated list of order IDs (max 10)"),
            origClientOrderIdList: z.string().optional().describe("Comma-separated list of client order IDs (max 10)")
        },
        async ({ symbol, orderIdList, origClientOrderIdList }) => {
            try {
                const params: any = { symbol };
                if (orderIdList) params.orderIdList = orderIdList;
                if (origClientOrderIdList) params.origClientOrderIdList = origClientOrderIdList;

                const data = await deliveryClient.cancelBatchOrders(params);
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `COIN-M Futures batch orders cancelled. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to cancel COIN-M Futures batch orders: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
