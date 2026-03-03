/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/account-api/marginType.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesMarginType(server: McpServer) {
    server.tool(
        "BinanceFuturesChangeMarginType",
        "Change margin type between ISOLATED and CROSSED for a USD-M Futures symbol. ⚠️ Cannot change if you have existing positions or open orders.",
        {
            symbol: z.string().describe("Futures symbol (e.g., BTCUSDT)"),
            marginType: z.enum(["ISOLATED", "CROSSED"]).describe("Margin type: ISOLATED or CROSSED"),
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
                        text: `✅ Margin type changed for ${params.symbol} to ${params.marginType}\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to change margin type: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
