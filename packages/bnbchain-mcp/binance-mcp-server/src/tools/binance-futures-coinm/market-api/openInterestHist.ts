/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-coinm/market-api/openInterestHist.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryOpenInterestHist(server: McpServer) {
    server.tool(
        "BinanceDeliveryOpenInterestHist",
        "Get historical open interest for a COIN-M Futures pair. Requires VIP 2+ or higher.",
        {
            pair: z.string().describe("Underlying pair (e.g., BTCUSD)"),
            contractType: z.enum(["ALL", "PERPETUAL", "CURRENT_QUARTER", "NEXT_QUARTER"]).describe("Contract type"),
            period: z.enum(["5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d"]).describe("Time period"),
            startTime: z.number().int().optional().describe("Start timestamp in milliseconds"),
            endTime: z.number().int().optional().describe("End timestamp in milliseconds"),
            limit: z.number().int().optional().describe("Number of results (default 30, max 500)")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.openInterestHist({
                    pair: params.pair,
                    contractType: params.contractType,
                    period: params.period,
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `📈 Historical Open Interest for ${params.pair} ${params.contractType}\n\nPeriod: ${params.period}\nRecords: ${Array.isArray(data) ? data.length : 0}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get open interest history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
