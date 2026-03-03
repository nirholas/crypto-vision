/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/trade-api/changePositionMode.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryChangePositionMode(server: McpServer) {
    server.tool(
        "BinanceDeliveryChangePositionMode",
        "Change COIN-M Futures position mode between Hedge Mode and One-way Mode.",
        {
            dualSidePosition: z.boolean().describe("true = Hedge Mode, false = One-way Mode"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.changePositionMode({
                    dualSidePosition: params.dualSidePosition,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                const mode = params.dualSidePosition ? "Hedge Mode" : "One-way Mode";
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Position mode changed to ${mode}!\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to change position mode: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
