// src/tools/binance-options/position.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsPosition(server: McpServer) {
    server.tool(
        "BinanceOptionsPosition",
        "Get current options position information.",
        {
            symbol: z.string().optional().describe("Option trading symbol (e.g., BTC-240126-42000-C)")
        },
        async ({ symbol }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;
                
                const data = await optionsClient.position(params);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Position information retrieved. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get position: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
