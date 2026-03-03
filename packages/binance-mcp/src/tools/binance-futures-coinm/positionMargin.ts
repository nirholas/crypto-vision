// src/tools/binance-futures-coinm/positionMargin.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deliveryClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesCOINMPositionMargin(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMPositionMargin",
        "Modify isolated position margin for COIN-M Futures.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSD_PERP)"),
            positionSide: z.enum(["BOTH", "LONG", "SHORT"]).optional().describe("Position side. Default BOTH for One-way Mode"),
            amount: z.number().describe("Amount to add or remove"),
            type: z.number().describe("1: Add margin, 2: Remove margin")
        },
        async ({ symbol, positionSide, amount, type }) => {
            try {
                const params: any = { symbol, amount, type };
                if (positionSide) params.positionSide = positionSide;

                const data = await deliveryClient.positionMargin(params);
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `COIN-M Futures position margin modified for ${symbol}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to modify COIN-M Futures position margin: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}

