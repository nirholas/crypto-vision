// src/tools/binance-futures-coinm/fundingRate.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deliveryClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesCOINMFundingRate(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMFundingRate",
        "Get funding rate history for COIN-M Futures.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (e.g., BTCUSD_PERP)"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            limit: z.number().optional().describe("Default 100; max 1000")
        },
        async ({ symbol, startTime, endTime, limit }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (limit !== undefined) params.limit = limit;

                const data = await deliveryClient.fundingRate(params);
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved ${data.length || 0} funding rate records for COIN-M Futures${symbol ? ` ${symbol}` : ''}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve COIN-M Futures funding rate: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
