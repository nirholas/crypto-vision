// src/tools/binance-spot/market-api/ticker.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spotClient } from "../../../config/binanceClient.js";

export function registerBinanceTicker(server: McpServer) {
    server.tool(
        "BinanceTicker",
        "Get 24-hour rolling window price change statistics for a symbol or all symbols.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            windowSize: z.string().optional().describe("Defaults to 1d. Valid values: 1d, 2d, 3d, 4d, 5d, 6d, 7d")
        },
        async ({ symbol, windowSize }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;
                if (windowSize) params.windowSize = windowSize;
                
                const response = await spotClient.restAPI.ticker(params);


                const data = await response.data();

                const isArray = Array.isArray(data);
                const responseText = isArray
                    ? `Retrieved ticker statistics for all symbols${windowSize ? ` with window size ${windowSize}` : ''}. Total items: ${data.length}.`
                    : `Retrieved ticker statistics for ${symbol}${windowSize ? ` with window size ${windowSize}` : ''}.`;

                return {
                    content: [
                        {
                            type: "text",
                            text: `${responseText} Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve ticker statistics: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}