// src/tools/binance-futures-coinm/marginType.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deliveryClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesCOINMMarginType(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMMarginType",
        "Change margin type for a symbol in COIN-M Futures.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSD_PERP)"),
            marginType: z.enum(["ISOLATED", "CROSSED"]).describe("Margin type: ISOLATED or CROSSED")
        },
        async ({ symbol, marginType }) => {
            try {
                const data = await deliveryClient.marginType({ symbol, marginType });
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `COIN-M Futures margin type changed to ${marginType} for ${symbol}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to change COIN-M Futures margin type: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}

