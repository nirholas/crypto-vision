// src/tools/binance-options/exchangeInfo.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsExchangeInfo(server: McpServer) {
    server.tool(
        "BinanceOptionsExchangeInfo",
        "Get current exchange trading rules and symbol information for options.",
        {
            symbol: z.string().optional().describe("Option trading symbol (e.g., BTC-240126-42000-C)")
        },
        async ({ symbol }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;
                
                const data = await optionsClient.exchangeInfo(params);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Exchange info retrieved successfully. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get exchange info: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
