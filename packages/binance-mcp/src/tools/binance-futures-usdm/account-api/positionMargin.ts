/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/account-api/positionMargin.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesPositionMargin(server: McpServer) {
    // Modify Isolated Position Margin
    server.tool(
        "BinanceFuturesModifyPositionMargin",
        "Add or reduce margin for an isolated position in USD-M Futures.",
        {
            symbol: z.string().describe("Futures symbol (e.g., BTCUSDT)"),
            amount: z.string().describe("Amount of margin to add (positive) or remove (negative)"),
            type: z.enum(["1", "2"]).describe("1: Add margin, 2: Reduce margin"),
            positionSide: z.enum(["BOTH", "LONG", "SHORT"]).optional().describe("Position side for Hedge Mode"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.modifyIsolatedPositionMargin({
                    symbol: params.symbol,
                    amount: params.amount,
                    type: parseInt(params.type),
                    ...(params.positionSide && { positionSide: params.positionSide }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `✅ Position margin modified for ${params.symbol}\nAmount: ${params.amount}\nType: ${params.type === "1" ? "Added" : "Reduced"}\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to modify position margin: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
    
    // Get Position Margin Change History
    server.tool(
        "BinanceFuturesGetPositionMarginHistory",
        "Get position margin change history for a USD-M Futures symbol.",
        {
            symbol: z.string().describe("Futures symbol (e.g., BTCUSDT)"),
            type: z.enum(["1", "2"]).optional().describe("1: Add margin, 2: Reduce margin"),
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            limit: z.number().int().max(500).optional().describe("Number of records. Default 500"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.getPositionMarginChangeHistory({
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
                        text: `Position margin history for ${params.symbol}: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get position margin history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
