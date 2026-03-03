// src/tools/binance-algo/spot-algo/spotTwapNewTrade.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { algoClient } from "../../../config/binanceClient.js";

export function registerBinanceSpotTwapNewTrade(server: McpServer) {
    server.tool(
        "BinanceSpotTimeWeightedAveragePriceNewOrder",
        "The TWAP (Time-Weighted Average Price) New Order API allows users to place TWAP algorithmic orders for USDⓈ-M Futures on Binance.",
        {
            symbol: z.string().describe("Trading symbol (e.g., BTCUSDT)"),
            side: z.enum(["BUY", "SELL"]).describe("Trading side (BUY or SELL)"),
            quantity: z
                .number()
                .positive()
                .describe(
                    "Quantity of base asset; Maximum notional per order is 200k, 2mm, or 10mm, depending on the symbol"
                ),
            duration: z
                .number()
                .int()
                .min(300)
                .max(86400)
                .describe("Duration for TWAP orders in seconds. Must be between 300 and 86400"),
            clientAlgoId: z
                .string()
                .length(32)
                .optional()
                .describe("A unique 32-character ID among Algo orders. If not sent, a default value will be assigned"),
            limitPrice: z
                .number()
                .positive()
                .optional()
                .describe("Limit price of the order; Defaults to market price if not sent")
        },
        async (params) => {
            try {
                const response = await algoClient.restAPI.timeWeightedAveragePriceSpotAlgo({
                    symbol: params.symbol,
                    side: params.side,
                    quantity: params.quantity,
                    duration: params.duration,
                    ...(params.clientAlgoId !== undefined && { clientAlgoId: params.clientAlgoId }),
                    ...(params.limitPrice !== undefined && { limitPrice: params.limitPrice })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `TWAP order on USDⓈ-M Contracts placed successfully for ${
                                params.symbol
                            }. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to place TWAP algorithmic orders for USDⓈ-M Futures on Binance: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
