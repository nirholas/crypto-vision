// src/tools/binance-spot/general-api/exchangeInfo.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spotClient } from "../../../config/binanceClient.js";

export function registerBinanceExchangeInfo(server: McpServer) {
    server.tool(
        "BinanceExchangeInfo",
        "Get exchange information including rate limits, symbol configs, etc.",
        {
            symbol: z.string().optional().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            symbols: z.array(z.string()).optional().describe("Array of symbols to get info for"),
            permissions: z.array(z.string()).optional().describe("Array of permissions to filter by")
        },
        async ({ symbol, symbols, permissions }) => {
            try {
                const params: any = {};
                
                if (symbol) params.symbol = symbol;
                if (symbols) params.symbols = symbols;
                if (permissions) params.permissions = permissions;
                
                const response = await spotClient.restAPI.exchangeInfo(params);

                const data = await response.data();

                const symbolCount = data.symbols?.length || 0;
                const exchangeFiltersCount = data.exchangeFilters?.length || 0;

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved exchange information. Total symbols: ${symbolCount}, Exchange filters: ${exchangeFiltersCount}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve exchange information: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
