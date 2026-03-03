/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/market-api/markPriceKlines.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryMarkPriceKlines(server: McpServer) {
    server.tool(
        "BinanceDeliveryMarkPriceKlines",
        "Get mark price kline/candlestick data for a COIN-M Futures symbol. Mark price is used for liquidation calculations.",
        {
            symbol: z.string().describe("Contract symbol (e.g., BTCUSD_PERP)"),
            interval: z.enum([
                "1m", "3m", "5m", "15m", "30m",
                "1h", "2h", "4h", "6h", "8h", "12h",
                "1d", "3d", "1w", "1M"
            ]).describe("Kline interval"),
            startTime: z.number().int().optional().describe("Start timestamp in milliseconds"),
            endTime: z.number().int().optional().describe("End timestamp in milliseconds"),
            limit: z.number().int().optional().describe("Number of klines (default 500, max 1500)")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.markPriceKlines({
                    symbol: params.symbol,
                    interval: params.interval,
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `📊 Mark Price Klines for ${params.symbol} (${params.interval})\n\nCandles: ${Array.isArray(data) ? data.length : 0}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get mark price klines: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
