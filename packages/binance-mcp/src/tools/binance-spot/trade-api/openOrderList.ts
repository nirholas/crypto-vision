// src/tools/binance-spot/trade-api/openOrderList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spotClient } from "../../../config/binanceClient.js";

export function registerBinanceOpenOrderList(server: McpServer) {
    server.tool(
        "BinanceOpenOrderList",
        "Query open OCO orders for a specific account or symbol.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (e.g., BTCUSDT)")
        },
        async ({ symbol }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;
                
                const response = await spotClient.restAPI.openOrderList(params);

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved open OCO orders${symbol ? ` for ${symbol}` : ''}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve open OCO orders: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}