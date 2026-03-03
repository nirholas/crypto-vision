// src/tools/binance-futures-usdm/cancelBatchOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMCancelBatchOrders(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMCancelBatchOrders",
        "Cancel multiple orders for USD-M Futures.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            orderIdList: z.string().optional().describe("Comma-separated list of order IDs (max 10)"),
            origClientOrderIdList: z.string().optional().describe("Comma-separated list of client order IDs (max 10)")
        },
        async ({ symbol, orderIdList, origClientOrderIdList }) => {
            try {
                const params: any = { symbol };
                if (orderIdList) params.orderIdList = orderIdList;
                if (origClientOrderIdList) params.origClientOrderIdList = origClientOrderIdList;

                const data = await futuresClient.cancelBatchOrders(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `USD-M Futures batch orders cancelled. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to cancel USD-M Futures batch orders: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
