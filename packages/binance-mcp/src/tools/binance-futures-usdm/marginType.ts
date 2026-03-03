// src/tools/binance-futures-usdm/marginType.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMMarginType(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMMarginType",
        "Change margin type for a symbol in USD-M Futures.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            marginType: z.enum(["ISOLATED", "CROSSED"]).describe("Margin type: ISOLATED or CROSSED")
        },
        async ({ symbol, marginType }) => {
            try {
                const data = await futuresClient.marginType({ symbol, marginType });
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `USD-M Futures margin type changed to ${marginType} for ${symbol}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to change USD-M Futures margin type: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
