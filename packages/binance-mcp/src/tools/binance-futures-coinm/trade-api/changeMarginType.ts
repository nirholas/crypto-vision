/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/trade-api/changeMarginType.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryChangeMarginType(server: McpServer) {
    server.tool(
        "BinanceDeliveryChangeMarginType",
        "Change margin type between ISOLATED and CROSSED for COIN-M Futures.",
        {
            symbol: z.string().describe("Contract symbol (e.g., BTCUSD_PERP)"),
            marginType: z.enum(["ISOLATED", "CROSSED"]).describe("Margin type"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.changeMarginType({
                    symbol: params.symbol,
                    marginType: params.marginType,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Margin type changed to ${params.marginType}!\n\n${JSON.stringify(data, null, 2)}`
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
