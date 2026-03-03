/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-convert/trade-api/placeLimitOrder.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { convertClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceConvertPlaceLimitOrder(server: McpServer) {
    server.tool(
        "BinanceConvertPlaceLimitOrder",
        "Places a limit order to convert between two tokens at a specified price, using either base or quote amount, with options for wallet type and order expiry.",
        {
            baseAsset: z.string().describe("Base asset (from `fromIsBase` in /exchangeInfo API)"),
            quoteAsset: z.string().describe("Quote asset"),
            limitPrice: z.number().positive().describe("Symbol limit price (from baseAsset to quoteAsset)"),
            baseAmount: z
                .number()
                .positive()
                .optional()
                .describe("Base asset amount (either this or quoteAmount is required)"),
            quoteAmount: z
                .number()
                .positive()
                .optional()
                .describe("Quote asset amount (either this or baseAmount is required)"),
            side: z.enum(["BUY", "SELL"]).describe("BUY or SELL"),
            walletType: z
                .enum(["SPOT", "FUNDING", "SPOT_FUNDING"])
                .optional()
                .describe("Type of assets used: SPOT, FUNDING, or SPOT_FUNDING. Default is SPOT"),
            expiredType: z
                .enum(["1_D", "3_D", "7_D", "30_D"])
                .describe("Expiration type: 1_D, 3_D, 7_D, or 30_D (D = days)"),
            recvWindow: z
                .number()
                .int()
                .max(60000, "recvWindow cannot be greater than 60000")
                .optional()
                .describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await convertClient.restAPI.placeLimitOrder({
                    baseAsset: params.baseAsset,
                    quoteAsset: params.quoteAsset,
                    limitPrice: params.limitPrice,
                    side: params.side,
                    expiredType: params.expiredType,
                    ...(params.baseAmount !== undefined && { baseAmount: params.baseAmount }),
                    ...(params.quoteAmount !== undefined && { quoteAmount: params.quoteAmount }),
                    ...(params.walletType && { walletType: params.walletType }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully placed the limit order. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to places a limit order: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
