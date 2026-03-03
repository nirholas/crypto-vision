/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-algo/future-algo/VPNewTrade.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { algoClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceVPNewTrade(server: McpServer) {
    server.tool(
        "BinanceVolumeParticipationNewTrade",
        "The Volume Participation (VP) New Order API allows users to place a VP order on USDⓈ-M Contracts in Binance Futures.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            side: z.enum(["BUY", "SELL"]).describe("Trading side (BUY or SELL)"),
            positionSide: z
                .enum(["BOTH", "LONG", "SHORT"])
                .optional()
                .describe(
                    "Default BOTH for One-way Mode; LONG or SHORT for Hedge Mode. It must be sent in Hedge Mode."
                ),
            quantity: z
                .number()
                .positive()
                .min(10000)
                .max(1000000)
                .describe("Quantity of base asset; Notional must be between 10,000 and 1,000,000 USDT"),
            urgency: z.enum(["LOW", "MEDIUM", "HIGH"]).describe("Execution speed: LOW, MEDIUM, HIGH"),
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
            recvWindow: z.number().int().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await algoClient.restAPI.volumeParticipationFutureAlgo({
                    symbol: params.symbol,
                    side: params.side,
                    quantity: params.quantity,
                    urgency: params.urgency,
                    ...(params.positionSide && { positionSide: params.positionSide }),
                    ...(params.clientAlgoId && { clientAlgoId: params.clientAlgoId }),
                    ...(params.reduceOnly !== undefined && { reduceOnly: params.reduceOnly }),
                    ...(params.limitPrice !== undefined && { limitPrice: params.limitPrice }),
                    recvWindow: params.recvWindow
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `VP order on USDⓈ-M Contracts placed successfully for ${
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
                            text: `Failed to place a VP order: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
