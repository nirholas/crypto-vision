/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/account-api/userTrades.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryUserTrades(server: McpServer) {
    server.tool(
        "BinanceDeliveryUserTrades",
        "Get COIN-M Futures account trade history for a symbol.",
        {
            symbol: z.string().optional().describe("Contract symbol (e.g., BTCUSD_PERP)"),
            pair: z.string().optional().describe("Filter by underlying pair (e.g., BTCUSD)"),
            startTime: z.number().int().optional().describe("Start timestamp in milliseconds"),
            endTime: z.number().int().optional().describe("End timestamp in milliseconds"),
            fromId: z.number().int().optional().describe("Trade ID to fetch from"),
            limit: z.number().int().optional().describe("Number of results (default 50, max 1000)"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.userTrades({
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.pair && { pair: params.pair }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.fromId && { fromId: params.fromId }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `📈 COIN-M Trade History\n\nTrades: ${Array.isArray(data) ? data.length : 0}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get user trades: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
