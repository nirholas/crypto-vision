// src/tools/binance-futures-coinm/depth.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deliveryClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesCOINMDepth(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMDepth",
        "Get order book depth data for a specific COIN-M Futures trading pair.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSD_PERP)"),
            limit: z.number().optional().describe("Depth of the order book. Default 500; max 1000. Valid limits: [5, 10, 20, 50, 100, 500, 1000]")
        },
        async ({ symbol, limit }) => {
            try {
                const params: any = { symbol };
                if (limit !== undefined) params.limit = limit;

                const data = await deliveryClient.depth(params);
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved COIN-M Futures order book depth for ${symbol}. Bids: ${data.bids?.length || 0}, Asks: ${data.asks?.length || 0}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve COIN-M Futures order book depth: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
