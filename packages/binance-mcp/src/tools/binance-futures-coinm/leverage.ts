// src/tools/binance-futures-coinm/leverage.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesCOINMLeverage(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMLeverage",
        "Change initial leverage for COIN-M futures symbol.",
        {
            symbol: z.string().describe("Trading symbol"),
            leverage: z.number().int().min(1).max(125).describe("Target leverage (1-125)"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await deliveryClient.changeInitialLeverage({
                    symbol: params.symbol,
                    leverage: params.leverage,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                return {
                    content: [{ type: "text", text: `COIN-M leverage changed: ${JSON.stringify(data)}` }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to change COIN-M leverage: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
