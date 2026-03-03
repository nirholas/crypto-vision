/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-algo/future-algo/TwapNewTrade.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { algoClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceTwapNewTrade(server: McpServer) {
    server.tool(
        "BinanceTimeWeightedAveragePriceNewOrder",
        "The Time-Weighted Average Price (TWAP) New Order API allows users to place a TWAP order on USDⓈ-M Contracts in Binance Futures. TWAP orders execute gradually over a specified duration to achieve a better average execution price while minimizing market impact.",
        {
            symbol: z.string().describe("Trading symbol (e.g., BTCUSDT)"),
            side: z.enum(["BUY", "SELL"]).describe("Trading side (BUY or SELL)"),
            positionSide: z
                .enum(["BOTH", "LONG", "SHORT"])
                .optional()
                .describe("Default BOTH for One-way Mode; LONG or SHORT for Hedge Mode. Must be sent in Hedge Mode."),
            quantity: z
                .number()
                .positive()
                .min(1000)
                .max(1000000)
                .describe("Quantity of base asset; Notional must be between 1,000 and 1,000,000 USDT"),
            duration: z
                .number()
                .int()
                .min(300)
                .max(86400)
                .describe("Duration for TWAP orders in seconds. Must be between 300 and 86400"),
            clientAlgoId: z.string().length(32).optional().describe("A unique 32-character ID among Algo orders"),
            reduceOnly: z
                .boolean()
                .optional()
                .describe("true or false. Default false; Cannot be sent in Hedge Mode or when opening a position"),
            limitPrice: z
                .number()
                .positive()
                .optional()
                .describe("Limit price of the order; Defaults to market price if not sent"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await algoClient.restAPI.timeWeightedAveragePriceFutureAlgo({
                    symbol: params.symbol,
                    side: params.side,
                    quantity: params.quantity,
                    duration: params.duration,
                    ...(params.positionSide && { positionSide: params.positionSide }),
                    ...(params.clientAlgoId && { clientAlgoId: params.clientAlgoId }),
                    ...(params.reduceOnly !== undefined && { reduceOnly: params.reduceOnly }),
                    ...(params.limitPrice !== undefined && { limitPrice: params.limitPrice }),
                    ...(params.recvWindow !== undefined && { recvWindow: params.recvWindow })
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
                            text: `Failed to place a TWAP order on: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
