// src/tools/binance-futures-usdm/depth.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMDepth(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMDepth",
        "Get order book depth data for a specific USD-M Futures trading pair.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            limit: z.number().optional().describe("Depth of the order book. Default 500; max 1000. Valid limits: [5, 10, 20, 50, 100, 500, 1000]")
        },
        async ({ symbol, limit }) => {
            try {
                const params: any = { symbol };
                if (limit !== undefined) params.limit = limit;

                const data = await futuresClient.depth(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved USD-M Futures order book depth for ${symbol}. Bids: ${data.bids?.length || 0}, Asks: ${data.asks?.length || 0}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve USD-M Futures order book depth: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
