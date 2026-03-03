// src/tools/binance-options/mark.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsMark(server: McpServer) {
    server.tool(
        "BinanceOptionsMark",
        "Get option mark price for a symbol or all symbols.",
        {
            symbol: z.string().optional().describe("Option trading symbol (e.g., BTC-240126-42000-C)")
        },
        async ({ symbol }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;
                
                const data = await optionsClient.mark(params);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Option mark price retrieved. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get mark price: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
