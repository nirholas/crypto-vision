// src/tools/binance-margin/isolated-margin-api/isolatedMarginFee.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceIsolatedMarginFee(server: McpServer) {
    server.tool(
        "BinanceIsolatedMarginFee",
        "Query isolated margin fee data including interest rates for borrowing.",
        {
            symbol: z.string().optional().describe("Isolated margin symbol (e.g., BTCUSDT)"),
            vipLevel: z.number().int().optional().describe("VIP level (default uses current account VIP level)"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.getIsolatedMarginFee({
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.vipLevel !== undefined && { vipLevel: params.vipLevel }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Isolated Margin Fee Data: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to query fee data: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
