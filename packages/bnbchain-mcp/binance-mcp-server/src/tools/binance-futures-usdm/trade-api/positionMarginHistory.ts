/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/trade-api/positionMarginHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesPositionMarginHistory(server: McpServer) {
    server.tool(
        "BinanceFuturesPositionMarginHistory",
        "Get the history of isolated position margin changes (additions and reductions).",
        {
            symbol: z.string().describe("Futures symbol (e.g., BTCUSDT)"),
            type: z.enum(["1", "2"]).optional().describe("1 = Add margin, 2 = Reduce margin (filter)"),
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            limit: z.number().int().optional().describe("Number of results (default 500, max 500)"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.getPositionMarginHistory({
                    symbol: params.symbol,
                    ...(params.type && { type: parseInt(params.type) }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `📊 Position Margin History for ${params.symbol}\n\nRecords: ${Array.isArray(data) ? data.length : 0}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get position margin history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
