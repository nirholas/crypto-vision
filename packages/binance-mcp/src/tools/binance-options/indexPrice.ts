// src/tools/binance-options/indexPrice.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsIndexPrice(server: McpServer) {
    server.tool(
        "BinanceOptionsIndexPrice",
        "Get the underlying index price for options.",
        {
            underlying: z.string().describe("Underlying asset (e.g., BTCUSDT)")
        },
        async ({ underlying }) => {
            try {
                const params: any = { underlying };
                
                const data = await optionsClient.index(params);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Index price for ${underlying} retrieved. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get index price: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
