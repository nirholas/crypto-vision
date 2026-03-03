// src/tools/binance-options/ticker.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsTicker(server: McpServer) {
    server.tool(
        "BinanceOptionsTicker",
        "Get 24hr ticker price change statistics for an option symbol.",
        {
            symbol: z.string().optional().describe("Option trading symbol (e.g., BTC-240126-42000-C)")
        },
        async ({ symbol }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;
                
                const data = await optionsClient.ticker(params);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `24hr ticker statistics retrieved. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get ticker: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
