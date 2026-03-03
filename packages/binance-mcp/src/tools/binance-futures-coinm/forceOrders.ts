// src/tools/binance-futures-coinm/forceOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deliveryClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesCOINMForceOrders(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMForceOrders",
        "Get user force orders (liquidation orders) for COIN-M Futures.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (e.g., BTCUSD_PERP)"),
            autoCloseType: z.enum(["LIQUIDATION", "ADL"]).optional().describe("Auto close type: LIQUIDATION or ADL"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            limit: z.number().optional().describe("Default 50; max 100")
        },
        async ({ symbol, autoCloseType, startTime, endTime, limit }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;
                if (autoCloseType) params.autoCloseType = autoCloseType;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (limit !== undefined) params.limit = limit;

                const data = await deliveryClient.forceOrders(params);
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved ${data.length || 0} COIN-M Futures force orders. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve COIN-M Futures force orders: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
