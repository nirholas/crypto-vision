/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-c2c/getC2CTradeHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { c2cClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetC2CTradeHistory(server: McpServer) {
    server.tool(
        "BinanceGetC2CTradeHistory",
        "Allows the user to retrieve their own past C2C trades, including details such as asset type, trade direction (BUY/SELL), fiat currency used, trade status, and more.",
        {
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            page: z.number().int().optional().describe("Page number, default is 1"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await c2cClient.restAPI.getC2CTradeHistory({
                    ...(params.startTime !== undefined && { startTime: params.startTime }),
                    ...(params.endTime !== undefined && { endTime: params.endTime }),
                    ...(params.page !== undefined && { page: params.page }),
                    ...(params.recvWindow !== undefined && { recvWindow: params.recvWindow })
                });
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved the past C2C trades. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to retrieve users past C2C trades: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
