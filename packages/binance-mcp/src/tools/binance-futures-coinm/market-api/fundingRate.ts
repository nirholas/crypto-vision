/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/market-api/fundingRate.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryFundingRate(server: McpServer) {
    server.tool(
        "BinanceDeliveryFundingRate",
        "Get funding rate history for a COIN-M Futures perpetual contract.",
        {
            symbol: z.string().describe("Contract symbol (e.g., BTCUSD_PERP)"),
            startTime: z.number().int().optional().describe("Start timestamp in milliseconds"),
            endTime: z.number().int().optional().describe("End timestamp in milliseconds"),
            limit: z.number().int().optional().describe("Number of results (default 100, max 1000)")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.fundingRate({
                    symbol: params.symbol,
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `📊 Funding Rate History for ${params.symbol}\n\nRecords: ${Array.isArray(data) ? data.length : 0}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get funding rate: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
