/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/options/market-api/klines.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerOptionsMarketKlines(server: McpServer) {
    server.tool(
        "BinanceOptionsKlines",
        "Get kline/candlestick data for an options contract. Returns OHLCV data for technical analysis.",
        {
            symbol: z.string().describe("Option symbol (e.g., 'BTC-240126-40000-C')"),
            interval: z.enum(["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d", "3d", "1w"])
                .describe("Kline interval"),
            startTime: z.number().int().optional()
                .describe("Start time in milliseconds"),
            endTime: z.number().int().optional()
                .describe("End time in milliseconds"),
            limit: z.number().int().min(1).max(1500).optional()
                .describe("Number of klines to return (default 500, max 1500)")
        },
        async (params) => {
            try {
                const response = await optionsClient.restAPI.klines({
                    symbol: params.symbol,
                    interval: params.interval,
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit })
                });
                
                const data = await response.data();
                
                let result = `✅ Klines - ${params.symbol} (${params.interval})\n\n`;
                
                if (Array.isArray(data) && data.length > 0) {
                    result += `Total candles: ${data.length}\n\n`;
                    result += `| Open Time | Open | High | Low | Close | Volume |\n`;
                    result += `|-----------|------|------|-----|-------|--------|\n`;
                    
                    data.slice(-10).forEach((kline: any) => {
                        const openTime = new Date(kline[0]).toISOString().slice(0, 16);
                        result += `| ${openTime} | ${kline[1]} | ${kline[2]} | ${kline[3]} | ${kline[4]} | ${kline[5]} |\n`;
                    });
                    
                    if (data.length > 10) {
                        result += `\nShowing last 10 of ${data.length} candles`;
                    }
                } else {
                    result += `No kline data found`;
                }
                
                return {
                    content: [{
                        type: "text",
                        text: result
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get Options klines: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
