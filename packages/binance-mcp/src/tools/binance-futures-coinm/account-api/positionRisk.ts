/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/account-api/positionRisk.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryPositionRisk(server: McpServer) {
    server.tool(
        "BinanceDeliveryPositionRisk",
        "Get current COIN-M Futures position information including unrealized PnL and liquidation price.",
        {
            marginAsset: z.string().optional().describe("Filter by margin asset (e.g., BTC)"),
            pair: z.string().optional().describe("Filter by trading pair (e.g., BTCUSD)"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.positionRisk({
                    ...(params.marginAsset && { marginAsset: params.marginAsset }),
                    ...(params.pair && { pair: params.pair }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `📊 COIN-M Position Risk\n\nPositions: ${Array.isArray(data) ? data.length : 0}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get position risk: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
