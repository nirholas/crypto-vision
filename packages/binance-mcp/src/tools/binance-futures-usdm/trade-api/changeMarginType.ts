/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/trade-api/changeMarginType.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesChangeMarginType(server: McpServer) {
    server.tool(
        "BinanceFuturesChangeMarginType",
        "Change margin type between ISOLATED and CROSSED for a USD-M Futures symbol. ISOLATED: Position uses its own margin. CROSSED: All positions share account margin.",
        {
            symbol: z.string().describe("Futures symbol (e.g., BTCUSDT)"),
            marginType: z.enum(["ISOLATED", "CROSSED"]).describe("ISOLATED: Separate margin per position. CROSSED: Shared margin across positions"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.changeMarginType({
                    symbol: params.symbol,
                    marginType: params.marginType,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Margin type changed successfully!\n\nSymbol: ${params.symbol}\nNew Margin Type: ${params.marginType}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to change margin type: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
