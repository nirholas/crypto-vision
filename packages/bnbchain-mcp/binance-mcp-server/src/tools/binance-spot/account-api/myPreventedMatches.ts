/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-spot/account-api/myPreventedMatches.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spotClient } from "../../../config/binanceClient.js";

export function registerBinanceMyPreventedMatches(server: McpServer) {
    server.tool(
        "BinanceMyPreventedMatches",
        "Get prevented matches for Self-Trade Prevention.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            preventedMatchId: z.number().optional().describe("Prevented match ID"),
            orderId: z.number().optional().describe("Order ID"),
            fromPreventedMatchId: z.number().optional().describe("Prevented match ID to fetch from"),
            limit: z.number().optional().describe("Default 500; max 1000"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ symbol, preventedMatchId, orderId, fromPreventedMatchId, limit, recvWindow }) => {
            try {
                const params: any = { symbol };
                
                if (preventedMatchId !== undefined) params.preventedMatchId = preventedMatchId;
                if (orderId !== undefined) params.orderId = orderId;
                if (fromPreventedMatchId !== undefined) params.fromPreventedMatchId = fromPreventedMatchId;
                if (limit !== undefined) params.limit = limit;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const response = await spotClient.restAPI.myPreventedMatches(params);

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved prevented matches for ${symbol}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve prevented matches: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
