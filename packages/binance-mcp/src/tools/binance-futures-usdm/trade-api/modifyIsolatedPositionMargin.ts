/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/trade-api/modifyIsolatedPositionMargin.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesModifyIsolatedPositionMargin(server: McpServer) {
    server.tool(
        "BinanceFuturesModifyIsolatedPositionMargin",
        "Add or reduce margin to/from an isolated margin position. Only works when margin type is ISOLATED.",
        {
            symbol: z.string().describe("Futures symbol (e.g., BTCUSDT)"),
            amount: z.string().describe("Amount of margin to add or reduce"),
            type: z.enum(["1", "2"]).describe("1 = Add margin, 2 = Reduce margin"),
            positionSide: z.enum(["BOTH", "LONG", "SHORT"]).optional().describe("Position side for Hedge Mode (default BOTH)"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.modifyIsolatedPositionMargin({
                    symbol: params.symbol,
                    amount: params.amount,
                    type: parseInt(params.type) as 1 | 2,
                    ...(params.positionSide && { positionSide: params.positionSide }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                const action = params.type === "1" ? "added to" : "reduced from";
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Margin ${action} position successfully!\n\nSymbol: ${params.symbol}\nAmount: ${params.amount}\nAction: ${params.type === "1" ? "Add" : "Reduce"}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to modify isolated position margin: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
