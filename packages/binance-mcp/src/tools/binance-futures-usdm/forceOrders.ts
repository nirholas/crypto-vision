// src/tools/binance-futures-usdm/forceOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMForceOrders(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMForceOrders",
        "Get user force orders (liquidation orders) for USD-M Futures.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
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

                const data = await futuresClient.forceOrders(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved ${data.length || 0} USD-M Futures force orders. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve USD-M Futures force orders: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
